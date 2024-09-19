import { execSync } from 'child_process';
import { createSpinner } from 'nanospinner';
import chalk from 'chalk';

const RED = chalk.redBright;
const GREEN = chalk.green;
const ICYAN = chalk.cyanBright;

class ncREDIS {
    constructor() {
        this.redisServiceName = 'redis-server';
    }

    /**
     * Install Redis if not already installed.
     */
    installRedis() {
        const spinner = createSpinner('Checking Redis installation...').start();

        try {
            execSync('which redis-server');
            spinner.success({ text: `${GREEN('Redis is already installed.')}` });
        } catch {
            try {
                spinner.update({ text: `${ICYAN('Installing Redis...')}` });
                execSync('sudo apt-get update && sudo apt-get install -y redis-server');
                execSync('sudo systemctl enable redis-server');
                execSync('sudo systemctl start redis-server');
                spinner.success({ text: `${GREEN('Redis installation complete.')}` });
            } catch (error) {
                spinner.error({ text: `${RED('Failed to install Redis.')}` });
                console.error(error);
            }
        }
    }

    /**
     * Remove Redis from the system.
     */
    removeRedis() {
        const spinner = createSpinner('Removing Redis...').start();

        try {
            execSync('sudo apt-get purge -y redis-server');
            execSync('sudo apt-get autoremove -y');
            spinner.success({ text: `${GREEN('Redis has been removed successfully.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to remove Redis.')}` });
            console.error(error);
        }
    }

    /**
     * Configure Redis as the Nextcloud cache backend.
     */
    configureRedisForNextcloud() {
        const spinner = createSpinner('Configuring Redis for Nextcloud...').start();

        try {
            // Add Redis as the local cache in Nextcloud config.php
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set memcache.local --value='\OC\Memcache\Redis'`);
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set memcache.locking --value='\OC\Memcache\Redis'`);
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis --value='{"host":"/var/run/redis/redis-server.sock","port":0,"timeout":0.0}'`);
            
            spinner.success({ text: `${GREEN('Redis has been configured for Nextcloud.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to configure Redis for Nextcloud.')}` });
            console.error(error);
        }
    }

    /**
     * Remove Redis configuration from Nextcloud config.php.
     */
    removeRedisConfigFromNextcloud() {
        const spinner = createSpinner('Removing Redis configuration from Nextcloud...').start();

        try {
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete memcache.local');
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete memcache.locking');
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:delete redis');
            spinner.success({ text: `${GREEN('Redis configuration has been removed from Nextcloud.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to remove Redis configuration.')}` });
            console.error(error);
        }
    }

    /**
     * Restart the Redis server.
     */
    restartRedis() {
        const spinner = createSpinner('Restarting Redis server...').start();

        try {
            execSync('sudo systemctl restart redis-server');
            spinner.success({ text: `${GREEN('Redis has been restarted.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to restart Redis.')}` });
            console.error(error);
        }
    }

    /**
     * Check the status of the Redis server.
     */
    checkRedisStatus() {
        const spinner = createSpinner('Checking Redis server status...').start();

        try {
            const status = execSync('sudo systemctl status redis-server').toString();
            console.log(status);
            spinner.success({ text: `${GREEN('Redis server status displayed.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to check Redis server status.')}` });
            console.error(error);
        }
    }
}

export default ncREDIS;
