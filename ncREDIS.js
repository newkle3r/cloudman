import { execSync } from 'child_process';
import { createSpinner } from 'nanospinner';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { RED, GREEN, YELLOW } from './color.js';

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
     * Install Redis if not already installed and configure Redis for PHP.
     */
    async installRedis() {
        const spinner = createSpinner('Checking Redis installation...').start();

        try {
            execSync('which redis-server');
            spinner.success({ text: `${GREEN('Redis is already installed.')}` });
        } catch {
            try {
                spinner.update({ text: `${YELLOW('Installing Redis...')}` });
                execSync('sudo apt-get update && sudo apt-get install -y redis-server', { stdio: 'inherit' });

                // Enable and start Redis
                execSync('sudo systemctl enable redis-server', { stdio: 'inherit' });
                execSync('sudo systemctl start redis-server', { stdio: 'inherit' });

                spinner.success({ text: `${GREEN('Redis installation complete.')}` });
            } catch (error) {
                spinner.error({ text: `${RED('Failed to install Redis.')}` });
                console.error(error);
                return;
            }
        }
    }

            async installRedisPhpModule() {
                const spinner = createSpinner('Installing PHP Redis extension...').start();
        
                try {
                    if (this.isRedisPhpModuleInstalled()) {
                        spinner.success({ text: `${GREEN('PHP Redis module is already installed.')}` });
                        return;
                    }
        
                    // Install PHP Redis extension if not installed
                    execSync('sudo pecl channel-update pecl.php.net', { stdio: 'inherit' });
                    execSync('yes no | sudo pecl install -Z redis', { stdio: 'inherit' });
        
                    // Ensure the PHP Redis module is enabled
                    this.configurePHPRedisModule();
                    spinner.success({ text: `${GREEN('PHP Redis module installed successfully.')}` });
                } catch (error) {
                    spinner.error({ text: `${RED('Failed to install PHP Redis module.')}` });
                    console.error(error);
                }
            }

    /**
     * Configure the PHP Redis module after installation.
     */
    configurePHPRedisModule() {
        try {
            const redisIniPath = `${this.phpModsDir}/redis.ini`;
            if (!fs.existsSync(redisIniPath)) {
                fs.writeFileSync(redisIniPath, 'extension=redis.so');
            }

            // Enable the Redis PHP module
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
     * Check and validate if config.php has the correct Redis and Memcache configuration.
     */
    checkAndFixNextcloudConfig() {
        const spinner = createSpinner('Checking Nextcloud config.php...').start();

        try {
            // Run all file access operations with sudo
            // Read the existing config.php with sudo
            const configFileContent = execSync(`sudo cat ${this.configFilePath}`).toString();

            // Look for Redis and Memcache settings in config.php
            const hasRedisConfig = configFileContent.includes("'redis' => array(");
            const hasMemcacheLocal = configFileContent.includes("'memcache.local' => '\\OC\\Memcache\\Redis'");
            const hasMemcacheLocking = configFileContent.includes("'memcache.locking' => '\\OC\\Memcache\\Redis'");
            const hasMemcacheDistributed = configFileContent.includes("'memcache.distributed' => '\\OC\\Memcache\\Redis'");

            // If all necessary configs are present, no need to modify
            if (hasRedisConfig && hasMemcacheLocal && hasMemcacheLocking && hasMemcacheDistributed) {
                spinner.success({ text: `${GREEN('Nextcloud config.php is correctly configured for Redis.')}` });
                return;
            }

            // If the configuration is incorrect, generate a new Redis password and rewrite the necessary parts of config.php
            const redisPass = this.generateRedisPassword();

            // Backup the current config.php using sudo
            execSync(`sudo cp ${this.configFilePath} ${this.backupConfigFilePath}`);
            console.log(YELLOW('Backup of config.php created.'));

            // Prepare the updated configuration for Redis and Memcache
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

            // Find where to insert or replace the Redis and Memcache configurations
            const newConfigFileContent = this.injectRedisConfig(configFileContent, updatedConfig);

            // Write the updated configuration back to config.php using sudo
            const tmpConfigPath = `/tmp/config.php`;
            fs.writeFileSync(tmpConfigPath, newConfigFileContent, 'utf8'); // Write the updated content to a temporary file
            execSync(`sudo mv ${tmpConfigPath} ${this.configFilePath}`); // Move the updated file to the correct location with sudo

            spinner.success({ text: `${GREEN('Nextcloud config.php updated with Redis configuration.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to validate or update config.php.')}` });
            console.error(error);
        }
    }

    /**
     * Inject Redis and Memcache configuration into the config.php content.
     * This preserves any existing customer customizations while updating the Redis/Memcache part.
     * 
     * @param {string} configFileContent - Original content of config.php.
     * @param {string} updatedConfig - Redis and Memcache configuration to be injected.
     * @returns {string} - Updated config.php content.
     */
    injectRedisConfig(configFileContent, updatedConfig) {
        // Look for the last closing array bracket ');' in the config.php file and insert the updated config before it
        const closingBracketPosition = configFileContent.lastIndexOf(');');
        if (closingBracketPosition === -1) {
            throw new Error('Invalid config.php format.');
        }

        // Insert the Redis configuration just before the closing array bracket
        const newConfigFileContent = configFileContent.slice(0, closingBracketPosition) + updatedConfig + configFileContent.slice(closingBracketPosition);
        return newConfigFileContent;
    }

    /**
     * Configure Redis as the Nextcloud cache backend and secure Redis.
     */
async configureRedisForNextcloud() {
    const spinner = createSpinner('Configuring Redis for Nextcloud...').start();
    const redisPass = this.generateRedisPassword();  // Generate a new Redis password

    try {
        // Set Redis configuration in Nextcloud
        execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis host --value="${this.redisSock}"`, { stdio: 'inherit' });
        execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis port --value=0`, { stdio: 'inherit' });
        execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis dbindex --value=0`, { stdio: 'inherit' });
        execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis timeout --value=0.5`, { stdio: 'inherit' });

        // Set Redis password
        execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis password --value="${redisPass}"`, { stdio: 'inherit' });

        // Configure Nextcloud caching
        execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set memcache.local --value='\\OC\\Memcache\\Redis'`, { stdio: 'inherit' });
        execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set memcache.locking --value='\\OC\\Memcache\\Redis'`, { stdio: 'inherit' });
        execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set memcache.distributed --value='\\OC\\Memcache\\Redis'`, { stdio: 'inherit' });

        // Update the Redis configuration file with the password and secure permissions
        execSync(`sudo sed -i "s|# requirepass .*|requirepass ${redisPass}|g" ${this.redisConf}`, { stdio: 'inherit' });
        execSync('sudo chown redis:root /etc/redis/redis.conf && sudo chmod 600 /etc/redis/redis.conf', { stdio: 'inherit' });

        // Update variables.json with the new Redis password
        this.updateRedisPasswordInVariables(redisPass);

        // Restart Redis to apply the changes
        execSync('sudo systemctl restart redis-server', { stdio: 'inherit' });

        spinner.success({ text: `${GREEN('Redis has been configured and secured for Nextcloud.')}` });
    } catch (error) {
        spinner.error({ text: `${RED('Failed to configure and secure Redis for Nextcloud.')}` });
        console.error(error);
    }
}

    /**
     * Configure Redis performance tweaks based on sysctl settings.
     */
    configureRedisPerformance() {
        try {
            // Enable memory overcommit
            execSync(`grep -q "vm.overcommit_memory = 1" /etc/sysctl.conf || echo 'vm.overcommit_memory = 1' | sudo tee -a /etc/sysctl.conf`);

            // Disable Transparent Huge Pages (THP)
            execSync(`grep -q "never" /sys/kernel/mm/transparent_hugepage/enabled || echo 'never' | sudo tee /sys/kernel/mm/transparent_hugepage/enabled`);

            // Configure Redis socket and disable TCP port
            execSync(`sudo sed -i "s|# unixsocket .*|unixsocket ${this.redisSock}|g" ${this.redisConf}`);
            execSync(`sudo sed -i "s|# unixsocketperm .*|unixsocketperm 777|g" ${this.redisConf}`);
            execSync(`sudo sed -i "s|^port.*|port 0|" ${this.redisConf}`);
            execSync(`sudo sed -i 's|# rename-command CONFIG ""|rename-command CONFIG ""|' ${this.redisConf}`);

            
            

            // Restart Redis server
            execSync('sudo systemctl restart redis-server');
            console.log(GREEN('Redis performance tweaks applied.'));
        } catch (error) {
            console.error(RED('Failed to apply Redis performance tweaks.'), error);
        }
    }

    /**
     * Remove Redis configuration from Nextcloud config.php.
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
     * Update the REDIS_PASS field in variables.json
     * @param {string} newRedisPassword - The new Redis password.
     */
        updateRedisPasswordInVariables(newRedisPassword) {
            try {
                // Read the existing variables.json
                const variablesContent = fs.readFileSync(this.variablesFile, 'utf8');
                const variables = JSON.parse(variablesContent);  // Parse the JSON
    
                // Update the REDIS_PASS field
                variables.REDIS_PASS = newRedisPassword;
    
                // Write the updated content back to variables.json
                fs.writeFileSync(this.variablesFile, JSON.stringify(variables, null, 2), 'utf8');
                console.log(GREEN('REDIS_PASS has been updated in variables.json.'));
            } catch (error) {
                console.error(RED('Failed to update REDIS_PASS in variables.json'), error);
            }
        }
    
    

    /**
     * Display a menu for Redis management, allowing the user to select an action.
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
                await this.configureRedisForNextcloud();
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
                checkAndFixNextcloudConfig();
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
