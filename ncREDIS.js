import { execSync } from 'child_process';
import { clearConsole,welcome } from './utils.js';
import { createSpinner } from 'nanospinner';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { RED, GREEN, YELLOW } from './color.js';
import fs from 'fs';

class ncREDIS {
    constructor() {
        this.redisServiceName = 'redis-server';
        this.redisConf = '/etc/redis/redis.conf';
        this.redisSock = '/var/run/redis/redis-server.sock';
        this.phpModsDir = `/etc/php/${this.getPHPVersion()}/mods-available`;
        this.configFilePath = '/var/www/nextcloud/config/config.php';
        this.backupConfigFilePath = '/var/www/nextcloud/config/config.php.bak';
        this.variablesFile = './variables.json';
    }

    /**
     * Get the current PHP version on the system.
     * @returns {string} PHP version.
     */
    getPHPVersion() {
        try {
            const phpVersion = execSync('php -v').toString().match(/^PHP\s+(\d+\.\d+)/);
            return phpVersion ? phpVersion[1] : 'unknown';
        } catch {
            console.error(RED('Failed to detect PHP version.'));
            return 'unknown';
        }
    }

    /**
     * Generate a strong random password for Redis.
     */
    generateRedisPassword(length = 16) {
        const charset = 'a-zA-Z0-9@#*';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return password;
    }

    /**
     * Delete Redis and Memcache configuration from Nextcloud.
     */
    async deleteNextcloudRedisConfig() {
        const spinner = createSpinner('Deleting existing Redis and Memcache configurations from Nextcloud...').start();

        try {
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete memcache.local', { stdio: 'inherit' });
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete memcache.distributed', { stdio: 'inherit' });
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete filelocking.enabled', { stdio: 'inherit' });
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete memcache.locking', { stdio: 'inherit' });
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete redis password', { stdio: 'inherit' });
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete redis', { stdio: 'inherit' });

            spinner.success({ text: `${GREEN('Existing Redis and Memcache configurations deleted.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to delete Redis and Memcache configurations.')}` });
            console.error(error);
        }
    }

    /**
     * Install Redis and PHP Redis module if not installed.
     */
    async installRedis() {
        await this.deleteNextcloudRedisConfig(); // Ensure config is deleted first
        const spinner = createSpinner('Checking Redis installation...').start();

        try {
            execSync('which redis-server');
            spinner.success({ text: `${GREEN('Redis is already installed.')}` });
        } catch {
            try {
                spinner.update({ text: `${YELLOW('Installing Redis...')}` });
                execSync('sudo apt-get update && sudo apt-get install -y redis-server', { stdio: 'inherit' });
                execSync('sudo systemctl enable redis-server && sudo systemctl start redis-server', { stdio: 'inherit' });
                spinner.success({ text: `${GREEN('Redis installation complete.')}` });
            } catch (error) {
                spinner.error({ text: `${RED('Failed to install Redis.')}` });
                console.error(error);
                return;
            }
        }

        await this.installRedisPhpModule();  // Install PHP Redis extension after Redis installation
    }

    /**
     * Install PHP Redis extension if not installed.
     */
    async installRedisPhpModule() {
        const spinner = createSpinner('Installing PHP Redis extension...').start();

        try {
            if (this.isRedisPhpModuleInstalled()) {
                spinner.success({ text: `${GREEN('PHP Redis module is already installed.')}` });
                return;
            }

            execSync('sudo pecl channel-update pecl.php.net', { stdio: 'inherit' });
            execSync('yes no | sudo pecl install -Z redis', { stdio: 'inherit' });

            this.configurePHPRedisModule();
            spinner.success({ text: `${GREEN('PHP Redis module installed successfully.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to install PHP Redis module.')}` });
            console.error(error);
        }
    }

    /**
     * Configure the PHP Redis module.
     */
    configurePHPRedisModule() {
        try {
            const redisIniPath = `${this.phpModsDir}/redis.ini`;
            if (!fs.existsSync(redisIniPath)) {
                fs.writeFileSync(redisIniPath, 'extension=redis.so');
            }
            execSync(`sudo phpenmod -v ALL redis`);
        } catch (error) {
            console.error(RED('Failed to configure PHP Redis module.'), error);
        }
    }

    /**
     * Remove Redis from the system.
     */
    async removeRedis() {
        const spinner = createSpinner('Removing Redis...').start();

        try {
            execSync('sudo apt-get purge -y redis-server', { stdio: 'inherit' });
            execSync('sudo apt-get autoremove -y', { stdio: 'inherit' });
            spinner.success({ text: `${GREEN('Redis has been removed successfully.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to remove Redis.')}` });
            console.error(error);
        }
    }

    /**
     * Remove Redis configuration from Nextcloud.
     */
    async removeRedisConfigFromNextcloud() {
        const spinner = createSpinner('Removing Redis configuration from Nextcloud...').start();
    
        try {
            // Remove Redis settings
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete redis', { stdio: 'inherit' });
    
            // Remove Memcache configurations
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete memcache.local', { stdio: 'inherit' });
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete memcache.locking', { stdio: 'inherit' });
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete memcache.distributed', { stdio: 'inherit' });
    
            // Optionally, ensure file locking is disabled after removing Redis
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:set filelocking.enabled --value=false', { stdio: 'inherit' });
    
            spinner.success({ text: `${GREEN('Redis and Memcache configuration has been removed from Nextcloud.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to remove Redis configuration.')}` });
            console.error(error);
        }
    }

    /**
     * Restart the Redis server.
     */
    async restartRedis() {
        const spinner = createSpinner('Restarting Redis server...').start();

        try {
            execSync('sudo systemctl restart redis-server', { stdio: 'inherit' });
            spinner.success({ text: `${GREEN('Redis has been restarted.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to restart Redis.')}` });
            console.error(error);
        }
    }

    /**
     * Check the status of the Redis server.
     */
    async checkRedisStatus() {
        const spinner = createSpinner('Checking Redis server status...').start();

        try {
            const status = execSync('sudo systemctl is-active redis-server', { stdio: 'pipe' }).toString().trim();
            if (status === 'active') {
                spinner.success({ text: `${GREEN('Redis is running.')}` });
            } else {
                spinner.error({ text: `${RED('Redis is not running.')}` });
            }
        } catch (error) {
            spinner.error({ text: `${RED('Failed to check Redis server status.')}` });
            console.error(error);
        }
    }

    /**
     * Check and fix Nextcloud config.php for Redis.
     */
    async checkAndFixNextcloudConfig() {
        const spinner = createSpinner('Checking Nextcloud config.php...').start();

        try {
            const configFileContent = execSync(`sudo cat ${this.configFilePath}`).toString();
            const redisPass = this.generateRedisPassword();

            const updatedConfig = `
                'memcache.local' => '\\OC\\Memcache\\Redis',
                'memcache.locking' => '\\OC\\Memcache\\Redis',
                'memcache.distributed' => '\\OC\\Memcache\\Redis',
                'redis' => array(
                    'host' => '${this.redisSock}',
                    'port' => 0,
                    'timeout' => 0.5,
                    'password' => '${redisPass}',
                    'dbindex' => 0,
                ),
            `;

            const newConfigFileContent = this.injectRedisConfig(configFileContent, updatedConfig);
            const tmpConfigPath = `/tmp/config.php`;
            fs.writeFileSync(tmpConfigPath, newConfigFileContent, 'utf8');
            execSync(`sudo mv ${tmpConfigPath} ${this.configFilePath}`);

            this.updateRedisPasswordInVariables(redisPass);
            spinner.success({ text: `${GREEN('Nextcloud config.php updated with Redis configuration.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to validate or update config.php.')}` });
            console.error(error);
        }
    }

    /**
     * Inject Redis and Memcache configuration into the config.php content.
     */
    injectRedisConfig(configFileContent, updatedConfig) {
        const closingBracketPosition = configFileContent.lastIndexOf(');');
        if (closingBracketPosition === -1) {
            throw new Error('Invalid config.php format.');
        }
        return configFileContent.slice(0, closingBracketPosition) + updatedConfig + configFileContent.slice(closingBracketPosition);
    }

    /**
     * Update the Redis password in variables.json.
     */
    updateRedisPasswordInVariables(newRedisPassword) {
        try {
            const variablesContent = fs.readFileSync(this.variablesFile, 'utf8');
            const variables = JSON.parse(variablesContent);
            variables.REDIS_PASS = newRedisPassword;
            fs.writeFileSync(this.variablesFile, JSON.stringify(variables, null, 2), 'utf8');
            console.log(GREEN('REDIS_PASS has been updated in variables.json.'));
        } catch (error) {
            console.error(RED('Failed to update REDIS_PASS in variables.json'), error);
        }
    }

    /**
     * Menu for managing Redis.
     */
    async manageRedis(mainMenu) {
        const choices = [
            { name: 'Install Redis', value: 'install' },
            { name: 'Remove Redis', value: 'remove' },
            { name: 'Configure Redis for Nextcloud', value: 'configure' },
            { name: 'Remove Redis from Nextcloud', value: 'removeConfig' },
            { name: 'Restart Redis', value: 'restart' },
            { name: 'Check Redis Status', value: 'status' },
            { name: 'Brute-force config', value: 'rewrite' },
            { name: '' },
            { name: 'Return to main menu', value: 'menu' }
        ];

        let continueMenu = true;

        while (continueMenu === true) {
            const answer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'Select a Redis management option:',
                    choices
                }
            ]);

            switch (answer.action) {
                case 'install':
                    await this.installRedis();
                    break;
                case 'remove':
                    await this.removeRedis();
                    break;
                case 'configure':
                    await this.checkAndFixNextcloudConfig();
                    break;
                case 'removeConfig':
                    await this.removeRedisConfigFromNextcloud();
                    break;
                case 'restart':
                    await this.restartRedis();
                    break;
                case 'status':
                    await this.checkRedisStatus();
                    break;
                case 'rewrite':
                    await this.checkAndFixNextcloudConfig();
                    break;
                case 'menu':
                    console.log(chalk.yellow('Returning to main menu...'));
                    continueMenu = false;
                    mainMenu();
                    break;
                default:
                    console.log('Invalid option, returning to redis menu');
            }
        }
    }
}

export default ncREDIS;
