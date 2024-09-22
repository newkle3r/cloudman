import fs from 'fs';
import { execSync } from 'child_process';
import { createSpinner } from 'nanospinner';
import inquirer from 'inquirer';
import chalk from 'chalk';

class ncPHP {
    constructor() {
        this.phpVersion = null;
    }

    /**
     * Check if necessary system processes like apt or dpkg are running.
     */
    checkProcess() {
        try {
            execSync('sudo fuser /var/lib/dpkg/lock');
            execSync('sudo fuser /var/lib/apt/lists/lock');
        } catch (error) {
            console.error(chalk.red('Apt or dpkg process is running. Please wait for it to complete.'));
            process.exit(1);
        }
    }

    /**
     * Enter Nextcloud maintenance mode.
     */
    enterMaintenanceMode() {
        console.log(chalk.cyan('Entering Nextcloud maintenance mode...'));
        execSync('sudo -u www-data php /var/www/nextcloud/occ maintenance:mode --on', { stdio: 'inherit' });
    }

    /**
     * Exit Nextcloud maintenance mode.
     */
    exitMaintenanceMode() {
        console.log(chalk.cyan('Exiting Nextcloud maintenance mode...'));
        execSync('sudo -u www-data php /var/www/nextcloud/occ maintenance:mode --off', { stdio: 'inherit' });
    }

    /**
     * Purge existing PHP versions and clean the system.
     */
    purgeOldPHPVersions() {
        const spinner = createSpinner('Purging old PHP versions...').start();
        try {
            execSync('sudo apt-mark unhold php*', { stdio: 'inherit' });
            execSync('sudo apt-get purge -y php* libapache2-mod-php*', { stdio: 'inherit' });
            execSync('sudo apt-get autoremove -y && sudo apt-get clean', { stdio: 'inherit' });
            execSync('sudo rm -rf /etc/php', { stdio: 'inherit' });
            spinner.success({ text: chalk.green('Old PHP versions purged successfully.') });
        } catch (error) {
            spinner.error({ text: chalk.red('Failed to purge PHP versions.') });
            console.error(error);
        }
    }

    /**
     * Install the specified PHP version and necessary modules.
     * @param {string} phpVersion - PHP version to install (e.g., '8.1')
     */
    async installPHP(phpVersion) {
        const spinner = createSpinner(`Installing PHP ${phpVersion}...`).start();
        try {
            // Add the repository and update
            execSync('sudo add-apt-repository -y ppa:ondrej/php', { stdio: 'inherit' });
            execSync('sudo apt-get update', { stdio: 'inherit' });

            // Install PHP and necessary modules
            execSync(`sudo apt-get install -y \
                php${phpVersion}-bcmath \
                php${phpVersion}-bz2 \
                php${phpVersion}-cli \
                php${phpVersion}-common \
                php${phpVersion}-curl \
                php${phpVersion}-dev \
                php${phpVersion}-fpm \
                php${phpVersion}-gd \
                php${phpVersion}-gmp \
                php${phpVersion}-imap \
                php${phpVersion}-intl \
                php${phpVersion}-ldap \
                php${phpVersion}-mbstring \
                php${phpVersion}-opcache \
                php${phpVersion}-pgsql \
                php${phpVersion}-readline \
                php${phpVersion}-soap \
                php${phpVersion}-xml \
                php${phpVersion}-zip \
                php${phpVersion}-redis \
                php${phpVersion}-smbclient`, { stdio: 'inherit' });

            // Configure PHP-FPM
            await this.configurePHPFPM(phpVersion);

            // Restart services
            execSync(`sudo a2enconf php${phpVersion}-fpm && sudo systemctl restart apache2`, { stdio: 'inherit' });
            spinner.success({ text: chalk.green(`PHP ${phpVersion} installed and configured successfully!`) });
        } catch (error) {
            spinner.error({ text: chalk.red(`Failed to install PHP ${phpVersion}.`) });
            console.error(error);
        }
    }

    /**
     * Configure PHP-FPM for the installed PHP version.
     * @param {string} phpVersion - PHP version to configure
     */
    async configurePHPFPM(phpVersion) {
        const spinner = createSpinner(`Configuring PHP-FPM for PHP ${phpVersion}...`).start();
        try {
            const phpFpmConf = `/etc/php/${phpVersion}/fpm/pool.d/nextcloud.conf`;
            const phpPoolConfig = `
[Nextcloud]
user = www-data
group = www-data
listen = /run/php/php${phpVersion}-fpm.nextcloud.sock
listen.owner = www-data
listen.group = www-data
pm = dynamic
pm.max_children = 8
pm.start_servers = 3
pm.min_spare_servers = 2
pm.max_spare_servers = 3
security.limit_extensions = .php
php_admin_value[cgi.fix_pathinfo] = 1
            `;
            fs.writeFileSync(phpFpmConf, phpPoolConfig);
            execSync(`sudo systemctl restart php${phpVersion}-fpm`, { stdio: 'inherit' });
            spinner.success({ text: chalk.green(`PHP-FPM configured for PHP ${phpVersion}`) });
        } catch (error) {
            spinner.error({ text: chalk.red(`Failed to configure PHP-FPM for PHP ${phpVersion}`) });
            console.error(error);
        }
    }

    /**
     * Manage the PHP setup via menu.
     * @param {function} mainMenu - Callback to return to main menu
     */
    async managePHP(mainMenu) {
        const choices = [
            'Install PHP',
            'Remove PHP',
            'Exit Maintenance Mode',
            'Go Back'
        ];

        const answer = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'PHP Management Menu:',
                choices
            }
        ]);

        switch (answer.action) {
            case 'Install PHP':
                const versionAnswer = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'phpVersion',
                        message: 'Enter the PHP version you want to install (e.g., 7.4, 8.1):'
                    }
                ]);
                if (versionAnswer.phpVersion) {
                    await this.purgeOldPHPVersions();
                    await this.installPHP(versionAnswer.phpVersion);
                } else {
                    console.error(chalk.red('You must specify a valid PHP version.'));
                }
                break;

            case 'Remove PHP':
                await this.purgeOldPHPVersions();
                break;

            case 'Exit Maintenance Mode':
                this.exitMaintenanceMode();
                break;

            case 'Go Back':
                mainMenu();
                break;
        }
    }
}

export default ncPHP;
