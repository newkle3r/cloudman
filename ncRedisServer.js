import { execSync } from 'child_process';
import fs from 'fs';
import { createSpinner } from 'nanospinner';
import chalk from 'chalk';
import { RED, GREEN, YELLOW, ICyan, IGreen } from './color.js';

class ncRedisServer {
    constructor() {
        this.redisConf = '/etc/redis/redis.conf';
        this.redisSock = '/var/run/redis/redis-server.sock';
        this.phpModsDir = `/etc/php/${this.getPHPVersion()}/mods-available`;
        this.redisPass = this.generateRedisPassword();
        this.phpVersion = this.getPHPVersion();
    }
    /**
     * Check the current PHP version.
     */
    getPHPVersion() {
        try {
            const phpVersion = execSync('php -v').toString().match(/^PHP\s+(\d+\.\d+)/);
            return phpVersion ? phpVersion[1] : 'unknown';
        } catch (error) {
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
     * Remove Redis and its configuration from Nextcloud.
     */
    async removeRedis() {
        const spinner = createSpinner('Removing Redis...').start();

        try {
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete memcache.local', { stdio: 'inherit' });
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete memcache.distributed', { stdio: 'inherit' });
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete filelocking.enabled', { stdio: 'inherit' });
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete memcache.locking', { stdio: 'inherit' });
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete redis password', { stdio: 'inherit' });
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete redis', { stdio: 'inherit' });

            execSync('sudo apt-get purge redis-server -y', { stdio: 'inherit' });
            execSync('sudo apt-get autoremove -y', { stdio: 'inherit' });
            execSync('sudo apt-get autoclean', { stdio: 'inherit' });

            spinner.success({ text: `${GREEN('Redis has been removed successfully.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to remove Redis.')}` });
            console.error(error);
        }
    }

    /**
     * Install Redis and PHP Redis module.
     */
    async installRedis() {
        const spinner = createSpinner('Installing Redis server...').start();

        try {
            execSync(`sudo apt-get update && sudo apt-get install -y php${this.phpVersion}-dev redis-server`, { stdio: 'inherit' });

            // Install PHP Redis module using PECL
            execSync('sudo pecl channel-update pecl.php.net', { stdio: 'inherit' });
            if (execSync(`yes no | sudo pecl install -Z redis`).toString().includes('failed')) {
                throw new Error('Redis PHP module installation failed');
            }

            if (!fs.existsSync(`${this.phpModsDir}/redis.ini`)) {
                fs.writeFileSync(`${this.phpModsDir}/redis.ini`, `extension=redis.so`);
            }

            if (!fs.readFileSync(`${this.phpModsDir}/redis.ini`, 'utf8').includes('extension=redis.so')) {
                fs.appendFileSync(`${this.phpModsDir}/redis.ini`, '\nextension=redis.so');
            }

            execSync(`sudo phpenmod -v ALL redis`);
            spinner.success({ text: `${GREEN('Redis server and PHP Redis module installed successfully.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to install Redis.')}` });
            console.error(error);
        }
    }

    /**
     * Apply Redis performance tweaks and configure for Nextcloud.
     */
    configureRedis() {
        const spinner = createSpinner('Configuring Redis for Nextcloud...').start();

        try {
            // Set redis options in config
            execSync(`sudo sed -i "s|# unixsocket .*|unixsocket ${this.redisSock}|g" ${this.redisConf}`);
            execSync(`sudo sed -i "s|# unixsocketperm .*|unixsocketperm 777|g" ${this.redisConf}`);
            execSync(`sudo sed -i "s|^port.*|port 0|" ${this.redisConf}`);
            execSync(`sudo sed -i 's|# rename-command CONFIG ""|rename-command CONFIG ""|' ${this.redisConf}`);

            execSync('sudo sysctl -w vm.overcommit_memory=1', { stdio: 'inherit' });
            execSync('echo "vm.overcommit_memory = 1" | sudo tee -a /etc/sysctl.conf', { stdio: 'inherit' });

            execSync('echo "never" | sudo tee /sys/kernel/mm/transparent_hugepage/enabled', { stdio: 'inherit' });

            // Restart Redis
            execSync('sudo systemctl restart redis-server', { stdio: 'inherit' });

            // Configure Nextcloud Redis
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis host --value="${this.redisSock}"`);
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis port --value="0"`);
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis dbindex --value="0"`);
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis timeout --value="0.5"`);

            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set memcache.local --value="\\OC\\Memcache\\Redis"`);
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set filelocking.enabled --value="true"`);
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set memcache.distributed --value="\\OC\\Memcache\\Redis"`);
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set memcache.locking --value="\\OC\\Memcache\\Redis"`);

            // Secure Redis with password
            execSync(`sudo sed -i "s|# requirepass .*|requirepass ${this.redisPass}|g" ${this.redisConf}`);
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis password --value="${this.redisPass}"`);
            execSync('sudo systemctl restart redis-server', { stdio: 'inherit' });

            spinner.success({ text: `${GREEN('Redis configured successfully for Nextcloud.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to configure Redis for Nextcloud.')}` });
            console.error(error);
        }
    }

    /**
     * Menu for managing Redis installation and configuration.
     */
    async manageRedis(mainMenu) {
        const choices = [
            { name: 'Install Redis', value: 'install' },
            { name: 'Remove Redis', value: 'remove' },
            { name: 'Configure Redis for Nextcloud', value: 'configure' },
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
                    this.configureRedis();
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

export default ncRedisServer;
