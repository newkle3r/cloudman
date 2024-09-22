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
            const PHPversionOutput = execSync('sudo php -v').toString().trim();
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
     * Purges all PHP versions, fixes broken dependencies, and cleans up the system.
     */
    async purgePHPVersions() {
        const spinner = createSpinner('Purging all PHP versions and cleaning system...').start();

        try {
            await this.forceUnholdPHP();
            execSync('sudo apt-get purge -y php* libapache2-mod-php*', { stdio: 'inherit' });
            execSync('sudo apt-get autoremove -y', { stdio: 'inherit' });
            execSync('sudo rm -rf /etc/php/', { stdio: 'inherit' });
            execSync('sudo apt-get install -f', { stdio: 'inherit' });
            execSync('sudo apt-get clean && sudo apt-get autoclean', { stdio: 'inherit' });
            execSync('sudo apt-get update', { stdio: 'inherit' });
            spinner.success({ text: chalk.green('PHP versions purged and system cleaned successfully') });
        } catch (error) {
            spinner.error({ text: chalk.red('Failed to purge PHP versions and clean the system') });
            console.error(error);
        }
    }

    /**
     * Forcefully unholds all PHP-related packages.
     */
    async forceUnholdPHP() {
        const spinner = createSpinner('Forcing unhold of all PHP-related packages...').start();

        try {
            execSync('sudo apt-mark unhold php*', { stdio: 'inherit' });
            spinner.success({ text: chalk.green('Successfully unheld all PHP packages.') });
        } catch (error) {
            spinner.error({ text: chalk.red('Failed to unhold PHP packages.') });
            console.error(error);
        }
    }

    /**
     * Installs the specified PHP version and necessary modules, as well as PECL extensions like igbinary and smbclient.
     * @param {string} phpVersion - The PHP version to install (e.g., '7.4', '8.0', '8.2')
     */
    async installPHP(phpVersion) {
        if (!phpVersion) {
            console.error(chalk.red('PHP version is undefined. Please specify a valid PHP version.'));
            return;
        }

        const spinner = createSpinner(`Installing PHP ${phpVersion}, necessary modules, and PECL extensions...`).start();

        try {
            execSync('sudo add-apt-repository -y ppa:ondrej/php', { stdio: 'inherit' });
            execSync('sudo apt-get update', { stdio: 'inherit' });

            execSync(`sudo apt-get install -y php${phpVersion} php${phpVersion}-fpm php${phpVersion}-redis php${phpVersion}-intl php${phpVersion}-ldap php${phpVersion}-imap php${phpVersion}-gd php${phpVersion}-pgsql php${phpVersion}-curl php${phpVersion}-xml php${phpVersion}-zip php${phpVersion}-mbstring php${phpVersion}-soap php${phpVersion}-gmp php${phpVersion}-bz2 php${phpVersion}-bcmath php-pear`, { stdio: 'inherit' });

            execSync(`sudo pecl install igbinary smbclient redis`, { stdio: 'inherit' });

            execSync(`sudo bash -c "echo 'extension=igbinary.so' > /etc/php/${phpVersion}/mods-available/igbinary.ini"`, { stdio: 'inherit' });
            execSync(`sudo bash -c "echo 'extension=smbclient.so' > /etc/php/${phpVersion}/mods-available/smbclient.ini"`, { stdio: 'inherit' });
            execSync(`sudo bash -c "echo 'extension=redis.so' > /etc/php/${phpVersion}/mods-available/redis.ini"`, { stdio: 'inherit' });

            execSync(`sudo phpenmod -v ALL igbinary smbclient redis`, { stdio: 'inherit' });

            await this.configurePHPFPM(phpVersion);

            execSync(`sudo a2enconf php${phpVersion}-fpm && sudo systemctl restart apache2`, { stdio: 'inherit' });

            spinner.success({ text: chalk.green(`PHP ${phpVersion}, PECL extensions (igbinary, smbclient) installed and configured successfully!`) });
        } catch (error) {
            spinner.error({ text: chalk.red(`Failed to install PHP ${phpVersion} or PECL extensions: ${error.message}`) });
            console.error(error);
        }
    }

    /**
     * Configures PHP-FPM for the specified version, ensuring pool and socket setup.
     * @param {string} phpVersion - PHP version to configure (e.g., '7.4', '8.0')
     */
    async configurePHPFPM(phpVersion) {
        const spinner = createSpinner(`Configuring PHP-FPM for PHP ${phpVersion}...`).start();

        try {
            const phpPoolDir = `/etc/php/${phpVersion}/fpm/pool.d`;
            const poolConfigPath = `${phpPoolDir}/nextcloud.conf`;
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

            execSync(`echo "${poolConfigContent}" | sudo tee ${poolConfigPath}`, { stdio: 'inherit' });
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
     * Repairs the Nextcloud PHP environment by reinstalling necessary packages.
     */
    async repairPHP() {
        const spinner = createSpinner('Repairing Nextcloud PHP environment...').start();

        try {
            // Reinstalling necessary PHP modules for Nextcloud
            execSync('sudo apt-get install -y php-gd php-mbstring php-curl php-intl php-zip php-xml php-bcmath', { stdio: 'inherit' });

            // Restarting Apache to apply changes
            execSync('sudo systemctl restart apache2', { stdio: 'inherit' });

            spinner.success({ text: chalk.green('Nextcloud PHP environment repaired successfully!') });
        } catch (error) {
            spinner.error({ text: chalk.red('Failed to repair Nextcloud PHP environment.') });
            console.error(error);
        }
    }

    /**
     * Starts tailing PHP logs for real-time monitoring.
     */
    tailPHPlogs() {
        const variables = JSON.parse(fs.readFileSync('variables.json', 'utf8'));
        const phpLogFile = `/var/log/php${variables.PHP}-fpm.log`;

        if (this.phpLogProcess) {
            console.log(chalk.yellow('PHP log tailing is already running.'));
            return;
        }

        console.log(`${chalk.yellow('Tailing PHP logs from:')} ${phpLogFile}`);
        this.phpLogProcess = spawn('sudo', ['tail', '-f', phpLogFile], { stdio: 'inherit' });

        this.phpLogProcess.on('error', (error) => {
            console.error(`${chalk.red('Error tailing logs:')} ${error.message}`);
            this.phpLogProcess = null;
        });

        process.on('SIGINT', () => {
            if (this.phpLogProcess) this.stopTailPHPlogs();
        });
    }

    /**
     * Stops real-time tailing of PHP logs.
     */
    stopTailPHPlogs() {
        if (this.phpLogProcess) {
            console.log(chalk.yellow('Stopping PHP log tailing...'));
            this.phpLogProcess.kill('SIGTERM');
            this.phpLogProcess = null;
        } else {
            console.log(chalk.red('No PHP log tailing process is running.'));
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
                            message: 'Enter the PHP version you want to install (e.g., 7.4, 8.0, 8.2):'
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
                            message: 'Enter the PHP version to configure (e.g., 7.4, 8.0, 8.2):'
                        }
                    ]);
                    if (configureVersionAnswer.phpVersion) {
                        await this.configurePHPFPM(configureVersionAnswer.phpVersion);
                    } else {
                        console.error(chalk.red('You must specify a valid PHP version.'));
                    }
                    break;
                case 'Tail PHP logs':
                    this.tailPHPlogs();
                    break;
                case 'Stop PHP log tailing':
                    this.stopTailPHPlogs();
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
