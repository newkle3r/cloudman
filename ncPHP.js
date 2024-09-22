import fs from 'fs';
import { execSync, spawn } from 'child_process';
import { createSpinner } from 'nanospinner';
import inquirer from 'inquirer';
import chalk from 'chalk';

class ncPHP {
    constructor() {
        this.phpVersion = null;
        this.phpLogProcess = null;
    }

    /**
     * Identifies the installed PHP version and updates the variables.json file.
     */
    async identifyPHP() {
        const spinner = createSpinner('Identifying PHP version...').start();

        try {
            const PHPversionOutput = execSync('php -v').toString().trim();
            const versionMatch = PHPversionOutput.match(/^PHP\s+(\d+\.\d+)/);
            if (!versionMatch) throw new Error('Unable to determine PHP version');

            this.phpVersion = versionMatch[1];

            this.updateVariablesFile('PHP', this.phpVersion);
            spinner.success({ text: `${chalk.green('PHP Version Identified and Updated:')} ${this.phpVersion}` });
        } catch (error) {
            spinner.error({ text: chalk.red('Failed to identify and update PHP version') });
            console.error(error);
        }
    }

    /**
     * Updates the variables.json file with the provided key and value.
     */
    updateVariablesFile(key, value) {
        const variablesPath = 'variables.json';
        let variables = {};

        if (fs.existsSync(variablesPath)) {
            variables = JSON.parse(fs.readFileSync(variablesPath, 'utf8'));
        }

        variables[key] = value;
        fs.writeFileSync(variablesPath, JSON.stringify(variables, null, 2), 'utf8');
    }

    /**
     * General function to purge PHP versions and perform cleanup.
     * @param {Array} versionsToPurge - List of PHP versions to purge
     */
    async purgePHPVersions(versionsToPurge = ['php7.*', 'php8.*']) {
        const spinner = createSpinner('Purging all PHP versions and cleaning system...').start();

        try {
            // Step 1: Purge all PHP versions
            execSync(`sudo apt-get purge -y ${versionsToPurge.join(' ')} libapache2-mod-php*`, { stdio: 'inherit' });
            execSync('sudo apt-get autoremove -y', { stdio: 'inherit' });
            execSync('sudo rm -rf /etc/php/', { stdio: 'inherit' });

            // Step 2: Fix broken dependencies
            execSync('sudo apt-get install -f', { stdio: 'inherit' });

            // Step 3: Clean APT cache
            execSync('sudo apt-get clean && sudo apt-get autoclean', { stdio: 'inherit' });

            // Step 4: Unhold packages if any are held
            const heldPackages = execSync('sudo apt-mark showhold').toString().trim();
            if (heldPackages.length > 0) {
                execSync(`sudo apt-mark unhold ${heldPackages}`, { stdio: 'inherit' });
            }

            // Step 5: Update repositories
            execSync('sudo apt-get update', { stdio: 'inherit' });

            spinner.success({ text: chalk.green('PHP purged and system cleaned successfully') });
        } catch (error) {
            spinner.error({ text: chalk.red('Failed to purge PHP versions and clean the system') });
            console.error(error);
        }
    }

    /**
     * Downgrades PHP to version 7.4 and resets all PHP-related configurations.
     */
    async downgradePHP74() {
        // Purge all PHP versions
        await this.purgePHPVersions();

        // Install PHP 7.4 and necessary modules
        await this.installPHP('7.4');
    }

    /**
     * Installs the specified PHP version and necessary modules.
     * @param {string} phpVersion - The PHP version to install (e.g., '7.4', '8.0')
     */
    async installPHP(phpVersion) {
        if (!phpVersion) {
            console.error(chalk.red('PHP version is undefined. Please specify a valid PHP version.'));
            return;
        }

        const spinner = createSpinner(`Installing PHP ${phpVersion} and necessary modules...`).start();

        try {
            // Step 6: Add the PPA, update system, and install PHP modules
            execSync(`sudo add-apt-repository -y ppa:ondrej/php && sudo apt-get update && sudo apt-get install -y php${phpVersion} php${phpVersion}-fpm php${phpVersion}-common php${phpVersion}-curl php${phpVersion}-xml php${phpVersion}-json php${phpVersion}-opcache`, { stdio: 'inherit' });

            // Step 7: Configure PHP-FPM
            await this.configurePHPFPM(phpVersion);

            // Enable PHP-FPM for Apache and restart services
            execSync(`sudo a2enconf php${phpVersion}-fpm && sudo systemctl restart apache2`, { stdio: 'inherit' });

            spinner.success({ text: chalk.green(`PHP ${phpVersion} installed and configured successfully!`) });
        } catch (error) {
            spinner.error({ text: chalk.red(`Failed to install PHP ${phpVersion}: ${error.message}`) });
            console.error(error);
        }
    }

    /**
     * Configures PHP-FPM for the specified version, ensuring pool and socket setup.
     * @param {string} phpVersion - PHP version to configure (e.g., '7.4', '8.0')
     */
    async configurePHPFPM(phpVersion = this.phpVersion) {
        const spinner = createSpinner(`Configuring PHP-FPM for PHP ${phpVersion}...`).start();

        try {
            const phpPoolDir = `/etc/php/${phpVersion}/fpm/pool.d`;
            const poolConfigPath = `${phpPoolDir}/nextcloud.conf`;
            const defaultConfPath = `${phpPoolDir}/www.conf`;

            const poolConfigContent = `
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

            // Write the Nextcloud pool configuration
            execSync(`echo "${poolConfigContent}" | sudo tee ${poolConfigPath}`, { stdio: 'inherit' });

            // Check if www.conf exists before attempting to move it
            if (fs.existsSync(defaultConfPath)) {
                execSync(`sudo mv ${defaultConfPath} ${defaultConfPath}.backup`, { stdio: 'inherit' });
            } else {
                console.log(chalk.yellow(`Notice: ${defaultConfPath} does not exist, skipping backup of www.conf.`));
            }

            // Restart PHP-FPM service
            execSync(`sudo systemctl restart php${phpVersion}-fpm`, { stdio: 'inherit' });

            spinner.success({ text: `PHP-FPM pool configuration updated for PHP ${phpVersion}` });
        } catch (error) {
            spinner.error({ text: `Failed to configure PHP-FPM: ${error.message}` });
            console.error(error);
        }
    }

    /**
     * Removes all installed PHP versions and related packages.
     */
    async removePHP() {
        const spinner = createSpinner('Removing PHP...').start();

        try {
            execSync('sudo -u www-data php /var/www/nextcloud/occ maintenance:mode --on');
            execSync('sudo systemctl stop apache2.service');
            execSync('sudo apt-get purge -y php* libapache2-mod-php* php7.* php8.* && sudo apt-get autoremove -y');
            execSync('sudo rm -Rf /etc/php');
            execSync('sudo systemctl start apache2.service');
            execSync('sudo -u www-data php /var/www/nextcloud/occ maintenance:mode --off');

            spinner.success({ text: chalk.green('PHP removed successfully, Apache restarted!') });
        } catch (error) {
            spinner.error({ text: chalk.red('Failed to remove PHP.') });
            console.error(error);
        }
    }

    /**
     * Manages PHP operations via menu.
     * @param {function} mainMenu - Callback to return to main menu
     */
    async managePHP(mainMenu) {
        let continueMenu = true;

        while (continueMenu) {
            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'PHP management:',
                    choices: [
                        'Identify Version',
                        'Downgrade to php7.4',
                        'Upgrade PHP',
                        'Repair Nextcloud PHP',
                        'Configure PHP-FPM',
                        'Tail PHP logs',
                        'Stop PHP log tailing', 
                        'Remove PHP',
                        'Go Back'
                    ],
                }
            ]);

            switch (answers.action) {
                case 'Identify Version':
                    await this.identifyPHP();
                    break;
                case 'Downgrade to php7.4':
                    await this.downgradePHP74();
                    break;
                case 'Upgrade PHP':
                    const versionAnswer = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'phpVersion',
                            message: 'Enter the PHP version you want to install (e.g., 7.4, 8.0, 8.3):'
                        }
                    ]);
                    if (versionAnswer.phpVersion) {
                        await this.installPHP(versionAnswer.phpVersion);
                    } else {
                        console.error(chalk.red('You must specify a valid PHP version.'));
                    }
                    break;
                case 'Repair Nextcloud PHP':
                    await this.repairPHP();
                    break;
                case 'Configure PHP-FPM':
                    const configureVersionAnswer = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'phpVersion',
                            message: 'Enter the PHP version to configure (e.g., 7.4, 8.0, 8.3):'
                        }
                    ]);
                    if (configureVersionAnswer.phpVersion) {
                        await this.configurePHPFPM(configureVersionAnswer.phpVersion);
                    } else {
                        console.error(chalk.red('You must specify a valid PHP version.'));
                    }
                    break;
                case 'Tail PHP logs':
                    await this.tailPHPlogs();
                    break;
                case 'Stop PHP log tailing':
                    await this.stopTailPHPlogs();
                    break;
                case 'Remove PHP':
                    await this.removePHP();
                    break;
                case 'Go Back':
                    continueMenu = false;
                    mainMenu();
                    break;
            }
        }
    }
}

export default ncPHP;
