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

            // Install the PHP Redis extension
            spinner.update({ text: `${YELLOW('Installing PHP Redis extension...')}` });
            try {
                execSync(`sudo apt-get install -y php${this.getPHPVersion()}-dev`, { stdio: 'inherit' });
                execSync('sudo pecl channel-update pecl.php.net', { stdio: 'inherit' });
                execSync('yes no | sudo pecl install -Z redis', { stdio: 'inherit' });
                this.configurePHPRedisModule();
                spinner.success({ text: `${GREEN('PHP Redis module installed.')}` });
            } catch (error) {
                spinner.error({ text: `${RED('Failed to install PHP Redis module.')}` });
                console.error(error);
            }

            // Configure Redis performance tweaks
            this.configureRedisPerformance();
        }
    }

    /**
     * Configure the PHP Redis module after installation.
     */
    configurePHPRedisModule() {
        try {
            if (!execSync(`grep -qFx extension=redis.so ${this.phpModsDir}/redis.ini`).toString().trim()) {
                execSync(`echo "# PECL redis" | sudo tee ${this.phpModsDir}/redis.ini`);
                execSync(`echo "extension=redis.so" | sudo tee -a ${this.phpModsDir}/redis.ini`);
                execSync(`sudo phpenmod -v ALL redis`);
            }
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
     * Configure Redis as the Nextcloud cache backend.
     */
    async configureRedisForNextcloud() {
        const spinner = createSpinner('Configuring Redis for Nextcloud...').start();

        try {
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set memcache.local --value='\\OC\\Memcache\\Redis'`, { stdio: 'inherit' });
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set memcache.locking --value='\\OC\\Memcache\\Redis'`, { stdio: 'inherit' });
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis --value='{"host":"${this.redisSock}","port":0,"timeout":0.5}'`, { stdio: 'inherit' });

            spinner.success({ text: `${GREEN('Redis has been configured for Nextcloud.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to configure Redis for Nextcloud.')}` });
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
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete memcache.local', { stdio: 'inherit' });
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete memcache.locking', { stdio: 'inherit' });
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete redis', { stdio: 'inherit' });
            spinner.success({ text: `${GREEN('Redis configuration has been removed from Nextcloud.')}` });
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
