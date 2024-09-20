import { execSync } from 'child_process';
import { createSpinner } from 'nanospinner';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { RED, GREEN, YELLOW } from './color.js';

class ncREDIS {
    constructor() {
        this.redisServiceName = 'redis-server';
    }

    /**
     * Install Redis if not already installed.
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
                execSync('sudo systemctl enable redis-server', { stdio: 'inherit' });
                execSync('sudo systemctl start redis-server', { stdio: 'inherit' });
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
            execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis --value='{"host":"/var/run/redis/redis-server.sock","port":0,"timeout":0.0}'`, { stdio: 'inherit' });
            spinner.success({ text: `${GREEN('Redis has been configured for Nextcloud.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to configure Redis for Nextcloud.')}` });
            console.error(error);
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
            const status = execSync('sudo systemctl status redis-server', { stdio: 'inherit' }).toString();
            console.log(status);
            spinner.success({ text: `${GREEN('Redis server status displayed.')}` });
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
            new inquirer.Separator(),
            { name: 'Return to main menu', value: 'menu' }
        ];

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
                return mainMenu();  // Call the mainMenu callback
        }

        // After the action is complete, return to the Redis menu
        await this.manageRedis(mainMenu);
    }
}

export default ncREDIS;
