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
     * General function to purge specified PHP versions.
     * @param {Array} versionsToPurge - List of versions to purge
     */
    async purgePHPVersions(versionsToPurge) {
        const spinner = createSpinner('Purging PHP versions...').start();

        try {
            const installedVersions = versionsToPurge.join(' ');
            if (installedVersions.length > 0) {
                execSync(`dpkg-query -l ${installedVersions}* | grep -E "ii|hi" | cut -d " " -f 3 | xargs sudo apt-get purge -y`, { stdio: 'inherit' });
            } else {
                execSync('dpkg-query -l php7.[5-9]* php8.* | grep -E "ii|hi" | cut -d " " -f 3 | xargs sudo apt-get purge -y', { stdio: 'inherit' });
            }
            spinner.success({ text: chalk.green('PHP versions purged successfully') });
        } catch (error) {
            spinner.error({ text: chalk.red('Failed to purge PHP versions') });
            console.error(error);
        }
    }

    /**
     * Downgrades PHP to version 7.4.
     */
    async downgradePHP74() {
        await this.purgePHPVersions(['php7.4', 'php8.0']);
        await this.installPHP('7.4');
    }

    /**
     * Installs the specified PHP version and necessary modules.
     * @param {string} phpVersion - The PHP version to install (e.g., '7.4', '8.0')
     */
    async installPHP(phpVersion) {
        const spinner = createSpinner(`Installing PHP ${phpVersion} and necessary modules...`).start();

        try {
            // Add PPA for PHP, update system, and install PHP modules
            execSync(`sudo add-apt-repository -y ppa:ondrej/php && sudo apt-get update && sudo apt-get install -y php${phpVersion} php${phpVersion}-fpm php${phpVersion}-common php${phpVersion}-curl php${phpVersion}-xml`, { stdio: 'inherit' });

            await this.configurePHPFPM(phpVersion);
            execSync(`sudo a2enconf php${phpVersion}-fpm && sudo systemctl restart apache2`, { stdio: 'inherit' });

            spinner.success({ text: chalk.green(`PHP ${phpVersion} installed and configured successfully!`) });
        } catch (error) {
            spinner.error({ text: chalk.red(`Failed to install PHP ${phpVersion}`) });
            console.error(error);
        }
    }

    /**
     * Configures PHP-FPM for the specified version, ensuring pool and socket setup.
     * @param {string} phpVersion - PHP version to configure (e.g., '7.4')
     */
    async configurePHPFPM(phpVersion = this.phpVersion) {
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
            execSync(`echo "${poolConfigContent}" | sudo tee ${poolConfigPath}`);
            execSync(`sudo mv ${phpPoolDir}/www.conf ${phpPoolDir}/www.conf.backup && sudo systemctl restart php${phpVersion}-fpm`);

            spinner.success({ text: `PHP-FPM pool configuration updated for PHP ${phpVersion}` });
        } catch (error) {
            spinner.error({ text: `Failed to configure PHP-FPM: ${error.message}` });
            console.error(error);
        }
    }

    /**
     * Repairs PHP installation by reinstalling necessary packages and updating configurations.
     */
    async repairPHP() {
        await this.purgePHPVersions([this.phpVersion]);
        await this.installPHP(this.phpVersion);
    }

    /**
     * Removes the installed PHP version and related packages.
     */
    async removePHP() {
        const spinner = createSpinner('Removing PHP...').start();

        try {
            execSync('sudo -u www-data php /var/www/nextcloud/occ maintenance:mode --on');
            execSync('sudo systemctl stop apache2.service');
            execSync('sudo apt-get purge php* -y && sudo apt-get autoremove -y && sudo rm -Rf /etc/php');
            execSync('sudo systemctl start apache2.service');
            execSync('sudo -u www-data php /var/www/nextcloud/occ maintenance:mode --off');

            spinner.success({ text: chalk.green('PHP removed successfully, Apache restarted!') });
        } catch (error) {
            spinner.error({ text: chalk.red('Failed to remove PHP.') });
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
                    await this.installPHP();
                    break;
                case 'Repair Nextcloud PHP':
                    await this.repairPHP();
                    break;
                case 'Configure PHP-FPM':
                    await this.configurePHPFPM();
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
