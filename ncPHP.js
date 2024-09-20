import { RED, BLUE, GREEN, YELLOW } from './color.js';
import { spawn } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import fs from 'fs';

class ncPHP {
    constructor() {
        this.phpVersion = null;
        this.phpLogProcess = null; // Store the tail process
    }

    /**
     * Displays a menu for PHP management tasks.
     * @returns {Promise<void>}
     */
    async managePHP(mainMenu) {
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
                    'Tail PHP logs',
                    'Stop PHP log tailing',  // New option to stop tailing logs
                    'Remove PHP',
                    'Go Back'
                ],
            }
        ]);

        switch (answers.action) {
            case 'Identify Version':
                return this.identifyPHP();
            case 'Downgrade to php7.4':
                return this.downgradePHP74();
            case 'Repair Nextcloud PHP':
                return this.repairPHP();
            case 'Tail PHP logs':
                return this.tailPHPlogs();
            case 'Stop PHP log tailing':
                return this.stopTailPHPlogs(); // Stop tailing logs
            case 'Remove PHP':
                return this.removePHP();
            case 'Go Back':
                mainMenu(); // Go back to main menu
                break;
        }
    }

    /**
     * Identifies the currently installed PHP version and updates the variables.json file.
     * @returns {Promise<void>}
     */
    async identifyPHP() {
        const spinner = createSpinner('Identifying PHP version...').start();

        try {
            const PHPversionOutput = execSync('php -v').toString().trim();
            const versionMatch = PHPversionOutput.match(/^PHP\s+(\d+\.\d+)/);
            if (!versionMatch) {
                throw new Error('Unable to determine PHP version');
            }

            this.phpVersion = versionMatch[1]; // Extract PHP version

            const variablesPath = 'variables.json';
            let variables = {};

            if (fs.existsSync(variablesPath)) {
                variables = JSON.parse(fs.readFileSync(variablesPath, 'utf8'));
            }

            variables.PHP = this.phpVersion;
            fs.writeFileSync(variablesPath, JSON.stringify(variables, null, 2), 'utf8');

            spinner.success({ text: `${GREEN('PHP Version Identified and Updated:')}\n${this.phpVersion}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to identify and update PHP version')}` });
            console.error(error);
        }
    }

    /**
     * Downgrades the currently installed PHP version to PHP 7.4.
     * @returns {Promise<void>}
     */
    async downgradePHP74() {
        const spinner = createSpinner('Downgrading PHP to version 7.4...').start();

        try {
            execSync('dpkg-query -l php8.1* | grep -E "ii|hi" | cut -d " " -f 3 | xargs sudo apt-get purge -y');
            execSync('sudo add-apt-repository -y ppa:ondrej/php');
            execSync('sudo apt-get update');
            execSync('sudo apt-get install -y php7.4 php7.4-fpm php7.4-bcmath php7.4-ldap php7.4-xml php7.4-curl php7.4-redis');
            execSync('sudo systemctl restart apache2 || sudo systemctl restart php7.4-fpm');

            spinner.success({ text: `${GREEN('Successfully downgraded PHP to version 7.4')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to downgrade PHP to version 7.4')}` });
            console.error(error);
        }
    }

    /**
     * Repairs the PHP installation for Nextcloud.
     * @returns {Promise<void>}
     */
    async repairPHP() {
        const spinner = createSpinner('Repairing PHP installation...').start();

        try {
            const variables = JSON.parse(fs.readFileSync('variables.json', 'utf8'));
            const PHPVER = variables.PHP;

            if (!PHPVER) {
                throw new Error('PHP version not specified in variables.json.');
            }

            execSync('sudo -u www-data php /var/www/nextcloud/occ maintenance:mode --on');
            execSync('sudo systemctl stop apache2.service');
            execSync('sudo apt-get purge apache2* -y && sudo apt-get autoremove -y && sudo apt-get clean');
            execSync('sudo apt-get install -y apache2');
            execSync('sudo a2enmod rewrite headers proxy proxy_fcgi ssl');
            execSync('sudo a2enconf php' + PHPVER + '-fpm');
            execSync('sudo systemctl restart apache2 php' + PHPVER + '-fpm');

            spinner.success({ text: `${GREEN('PHP installation repaired successfully!')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to repair PHP installation')}` });
            console.error(error);
        }
    }

    /**
     * Removes the installed PHP and its associated packages.
     * @returns {void}
     */
    removePHP() {
        const spinner = createSpinner('Starting PHP removal process...').start();

        try {
            execSync('sudo -u www-data php /var/www/nextcloud/occ maintenance:mode --on');
            execSync('sudo systemctl stop apache2.service');
            execSync('sudo apt-get purge php* -y && sudo apt-get autoremove -y && sudo rm -Rf /etc/php');
            execSync('sudo systemctl start apache2.service');
            execSync('sudo -u www-data php /var/www/nextcloud/occ maintenance:mode --off');

            spinner.success({ text: `${GREEN('PHP has been successfully removed, Apache is retained!')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to remove PHP.')}` });
            console.error(error);
        }
    }

    /**
     * Tails the PHP logs in real-time.
     */
    tailPHPlogs() {
        
        const variables = JSON.parse(fs.readFileSync('variables.json', 'utf8'));
        const phpLogFile = `/var/log/php${variables.PHP}-fpm.log`;

        if (this.phpLogProcess) {
            console.log(chalk.yellow('PHP log tailing is already running.'));
            return;
        }

        console.log(`${YELLOW('Tailing PHP logs from:')} ${phpLogFile}`);

        this.phpLogProcess = spawn('tail', ['-f', phpLogFile]);

        this.phpLogProcess.stdout.on('data', (data) => {
            console.log(`${GREEN(data.toString())}`);
        });

        this.phpLogProcess.stderr.on('data', (data) => {
            console.error(`${RED('Error tailing logs:')} ${data.toString()}`);
        });

        this.phpLogProcess.on('close', () => {
            console.log(chalk.green('PHP log tailing stopped.'));
            this.phpLogProcess = null;  // Clear the process once stopped
        });
    }

    /**
     * Stops the tailing of PHP logs.
     */
    stopTailPHPlogs() {
        if (this.phpLogProcess) {
            console.log(chalk.yellow('Stopping PHP log tailing...'));
            this.phpLogProcess.kill();  // Kill the log tailing process
            this.phpLogProcess = null;
        } else {
            console.log(chalk.red('No PHP log tailing process is running.'));
        }
    }
}
/*
// Main entry point
(async () => {
    const phpManager = new ncPHP();
    await phpManager.managePHP();
})();

*/
export default ncPHP;
