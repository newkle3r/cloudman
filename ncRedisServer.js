import { execSync } from 'child_process';
import inquirer from 'inquirer';
import fs from 'fs';
import { createSpinner } from 'nanospinner';
import chalk from 'chalk';
import { RED, GREEN, YELLOW, CYAN } from './color.js';

class ncRedisServer {
    constructor(mainMenu) {
        this.redisConf = '/etc/redis/redis.conf';
        this.redisSock = '/var/run/redis/redis-server.sock';
        this.phpModsDir = `/etc/php/${this.getPHPVersion()}/mods-available`;
        this.redisPass = this.generateRedisPassword();
        this.phpVersion = this.getPHPVersion();
        this.mainMenu = mainMenu;
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
     * Check if Nextcloud is working properly using `occ -V`.
     * @returns {boolean} - True if Nextcloud is working, false otherwise.
     */
    checkNextcloudStatus() {
        try {
            // Use sudo to run the occ command
            const result = execSync('sudo -u www-data php /var/www/nextcloud/occ -V').toString().trim();
            console.log(`Nextcloud Status: ${result}`);

            // Regex to match 'hostname version'
            const validResultPattern = /^[\w\-]+\s+\d+(\.\d+)*$/;
            if (validResultPattern.test(result)) {
                console.log('Nextcloud is working properly.');
                return true;
            } else {
                console.error('Nextcloud is not functioning correctly.');
                return false;
            }
        } catch (error) {
            console.error('Error checking Nextcloud status:', error);
            return false;
        }
    }

    /**
     * Helper function to comment out Redis-related configuration in config.php.
     * This function searches the specified keys and comments them out if found.
     * @param {string} filePath - Path to the Nextcloud config.php file.
     */
    modifyConfigFile(filePath) {
        try {
            

            // Read the config.php file content using sudo
            let fileContent = execSync(`sudo cat ${filePath}`).toString().split('\n');

            // Define the Redis-related lines to comment out
            const redisConfigPatterns = [
                /'memcache\.local'\s*=>\s*.+/,
                /'memcache\.locking'\s*=>\s*.+/,
                /'memcache\.distributed'\s*=>\s*.+/,
                /'redis'\s*=>\s*array\s*\(/,
                /'host'\s*=>\s*.+/,
                /'port'\s*=>\s*.+/,
                /'timeout'\s*=>\s*.+/,
                /'password'\s*=>\s*.+/,
                /'dbindex'\s*=>\s*.+/,
                /'filelocking\.enabled'\s*=>\s*.+/,
            ];

            // Modify the config lines
            const modifiedContent = fileContent.map(line => {
                for (const pattern of redisConfigPatterns) {
                    if (pattern.test(line)) {
                        return `// ${line}`;  // Comment out the line
                    }
                }
                return line;
            });

            // Write the modified content back to config.php using sudo
            const tempFilePath = `/tmp/modified_config.php`;
            fs.writeFileSync(tempFilePath, modifiedContent.join('\n'), 'utf8');
            execSync(`sudo mv ${tempFilePath} ${filePath}`);

            


            
            console.log('Successfully modified the Redis configuration in config.php');
        } catch (error) {
            console.error('Error modifying the config.php file:', error);
        }
    }

    
    /**
     * Remove Redis and its configuration from Nextcloud.
     */
    async removeRedis(phpVersion) {
        const spinner = createSpinner('Removing Redis...').start();
        const nextcloudConfigPath = '/var/www/nextcloud/config/config.php';

        execSync(`sudo chown -R www-data:www-data /var/www/nextcloud/config`);
        execSync(`sudo chmod 755 /var/www/nextcloud/config`);

        // Check if Nextcloud is functioning
        if (!this.checkNextcloudStatus()) {
            console.log('Modifying Nextcloud configuration to remove Redis references...');
            this.modifyConfigFile(nextcloudConfigPath);
        }
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

            console.log('Checking if Redis PHP module is installed...');
            try {
                execSync('sudo pecl uninstall redis', { stdio: 'inherit' });
                console.log('Redis PHP module uninstalled successfully.');
            } catch (error) {
                console.log('Redis PHP module is not installed or uninstallation failed, skipping to install...');
            }

            spinner.success({ text: `${GREEN('Redis has been removed successfully.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to remove Redis.')}` });
            console.error(error);
        }
    }

    /**
     * Install Redis and PHP Redis module.
     */
    async installRedis(phpVersion) {
        const spinner = createSpinner('Installing Redis server...').start();

        execSync(`sudo chown -R www-data:www-data /var/www/nextcloud/config`);
        execSync(`sudo chmod 755 /var/www/nextcloud/config`);

        

        try {
            console.log`${GREEN(`installing php${this.phpVersion}-dev redis-server-`)}`;
            execSync(`sudo apt-get update && sudo apt-get install -y php${this.phpVersion}-dev php${this.phpVersion}-xml redis-server`, { stdio: 'inherit' });
            

            console.log`${GREEN(`reinstall php-pear`)}`;
            execSync(`sudo apt-get install --reinstall php-pear`);
            console.log`${GREEN(`update pecl.php.net`)}`;
            execSync(`sudo pecl channel-update pecl.php.net`);
            console.log`${GREEN(`activate phpenmod xml`)}`;
            execSync(`sudo phpenmod xml`);
            console.log`${GREEN(``)}`;

            
            
            } catch (error) {
                console.error('Error during Redis PHP module installation process:', error.message);
            }

            // Install PHP Redis module using PECL
            /*
            execSync('sudo pecl channel-update pecl.php.net', { stdio: 'inherit' });
            try {
                execSync(`printf "yes\nno\nno\nno\nno\nno\nno\nyes\n" | sudo pecl install -Z redis`, { stdio: 'inherit' });
                console.log('Redis installed successfully');
            } catch (error) {
                console.error('Error installing Redis:', error.message);
            }
            */

            if (!fs.existsSync(`${this.phpModsDir}/redis.ini`)) {
                // Create the redis.ini file using sudo
                try {

                execSync(`echo "extension=redis.so" | sudo tee ${this.phpModsDir}/redis.ini`, { stdio: 'inherit' });
                execSync(`sudo cat ${this.phpModsDir}/redis.ini | grep redis`);
                console.log(`succesfully wrote to ${this.phpModsDir}/redis.ini`);
                }
                catch {
                    console.log(`failed to write to ${this.phpModsDir}/redis.ini`)

                }
            }
            
            const redisIniContent = fs.readFileSync(`${this.phpModsDir}/redis.ini`, 'utf8');
            if (!redisIniContent.includes('extension=redis.so')) {
                // Append the redis extension using sudo
                execSync(`echo "extension=redis.so" | sudo tee -a ${this.phpModsDir}/redis.ini`, { stdio: 'inherit' });
            }

            // execSync(`sudo phpenmod -v ALL redis`);
            execSync(`sudo phpenmod -v ${phpVersion} redis`, { stdio: 'inherit' })
            spinner.success({ text: `${GREEN('Redis server and PHP Redis module installed successfully.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to install Redis.')}` });
            console.error(error);
        }
    

    /**
     * Apply Redis performance tweaks and configure for Nextcloud.
     */
    configureRedis(phpVersion) {
        const spinner = createSpinner('Configuring Redis for Nextcloud...').start();
    
        try {
            console.log('Setting Redis socket and permissions in the Redis config...');
            execSync(`sudo sed -i "s|# unixsocket .*|unixsocket ${this.redisSock}|g" ${this.redisConf}`);
            execSync(`sudo sed -i "s|# unixsocketperm .*|unixsocketperm 777|g" ${this.redisConf}`);
            execSync(`sudo sed -i "s|^port.*|port 0|" ${this.redisConf}`);
            execSync(`sudo sed -i 's|# rename-command CONFIG ""|rename-command CONFIG ""|' ${this.redisConf}`);
    
            console.log('Configuring memory overcommit...');
            execSync('sudo sysctl -w vm.overcommit_memory=1', { stdio: 'inherit' });
            execSync('echo "vm.overcommit_memory = 1" | sudo tee -a /etc/sysctl.conf', { stdio: 'inherit' });
    
            console.log('Disabling Transparent Huge Pages...');
            execSync('echo "never" | sudo tee /sys/kernel/mm/transparent_hugepage/enabled', { stdio: 'inherit' });
    
            console.log('Restarting Redis service...');
            execSync('sudo systemctl restart redis-server', { stdio: 'inherit' });
    
            console.log('Configuring Redis for Nextcloud...');
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis host --value="${this.redisSock}"`);
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis port --value="0"`);
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis dbindex --value="0"`);
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis timeout --value="0.5"`);
    
            console.log('Configuring Memcache settings...');
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set memcache.local --value="\\OC\\Memcache\\Redis"`);
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set filelocking.enabled --value="true"`);
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set memcache.distributed --value="\\OC\\Memcache\\Redis"`);
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set memcache.locking --value="\\OC\\Memcache\\Redis"`);
    
            console.log('Securing Redis with a password...');
            execSync(`sudo sed -i "s|# requirepass .*|requirepass ${this.redisPass}|g" ${this.redisConf}`);
            console.log(`Redis password set in Redis config: ${this.redisPass}`);
            
            console.log('Setting Redis password in Nextcloud...');
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis password --value="${this.redisPass}"`);
            console.log(`Redis password set in Nextcloud config: ${this.redisPass}`);
    
            console.log('Restarting Redis service after securing...');
            execSync('sudo systemctl restart redis-server', { stdio: 'inherit' });

            execSync(`sudo chown -R www-data:www-data /var/www/nextcloud/`);
            execSync(`sudo chmod 755 /var/www/nextcloud/config/config.php`);

            execSync(`chown redis:root /etc/redis/redis.conf`);
            execSync(`chmod 600 /etc/redis/redis.conf`);

    
            spinner.success({ text: 'Redis configured successfully for Nextcloud!' });
        } catch (error) {
            spinner.error({ text: 'Failed to configure Redis: ' + error.message });
            console.error('Error during Redis configuration:', error);
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
                    this.mainMenu();
                    break;
                default:
                    console.log('Invalid option, returning to redis menu');
            }
        }
    }
}

export default ncRedisServer;
