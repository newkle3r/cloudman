import { RED, BLUE, GREEN, YELLOW } from './color.js';
import { spawn } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import fs from 'fs';

/**
 * Class responsible for managing PHP tasks in Nextcloud.
 * Includes methods for identifying, upgrading, downgrading, repairing, and removing PHP.
 * 
 * @class ncPHP
 * @remarks The order of upgrades is important!
 * @remarks NC<25 => PHP7.4, NC>25 & Ubuntu<22 => PHP8.1, NC>28 & Ubuntu<24 => PHP8.3
 */
class ncPHP {
    constructor() {
        this.phpVersion = null;
        this.phpLogProcess = null; // Process för att titta på PHP-loggar
    }

    /**
     * @function managePHP 
     * @description Visar en meny för att hantera PHP-relaterade uppgifter i Nextcloud.
     * Får `mainMenu()` från `index.js > mainMenu` som används för att återgå till huvudmenyn.
     * 
     * @param {Function} mainMenu - Huvudmenyn från `index.js > mainMenu()` som anropas när användaren väljer att gå tillbaka.
     * @see answers.action - Hanterar användarens val i menyn för PHP-hantering.
     * @returns {Promise<void>} - Returnerar en Promise som avslutas när användarens val är bearbetat.
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
                    'Stop PHP log tailing', 
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
                return this.stopTailPHPlogs();
            case 'Remove PHP':
                return this.removePHP();
            case 'Go Back':
                mainMenu(); 
                break;
        }
    }

    /**
     * @function identifyPHP
     * @description Identifierar den installerade PHP-versionen och uppdaterar filen variables.json.
     * @file ./variables.json - Filen som uppdateras med den identifierade PHP-versionen.
     * @var variables.PHP - Variabeln där PHP-versionen sparas.
     * @returns {Promise<void>} - Returnerar en Promise som avslutas efter att versionen har identifierats och uppdaterats.
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
     * @function downgradePHP74
     * @description Nedgraderar den installerade PHP-versionen till PHP 7.4.
     * @returns {Promise<void>} - Returnerar en Promise som avslutas när nedgraderingen är klar.
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
     * @function repairPHP
     * @description Reparerar PHP-installationen för Nextcloud.
     * @returns {Promise<void>} - Returnerar en Promise som avslutas när PHP-installationen har reparerats.
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
     * @function removePHP
     * @description Tar bort den installerade PHP-versionen och dess tillhörande paket.
     * @returns {void} - Utför borttagning av PHP utan att returnera ett värde.
     * @remark OBS! PHP är helt avgörande för att kunna köra Nextcloud
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
     * @function tailPHPlogs
     * @description PHP loggar för felsökning
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
            this.phpLogProcess = null;  // Rensa processen när den stoppats
        });
    }

    /**
     * @function stopTailPHPlogs
     * @description Stoppar loggning av PHP-loggar i realtid.
     */
    stopTailPHPlogs() {
        if (this.phpLogProcess) {
            console.log(chalk.yellow('Stopping PHP log tailing...'));
            this.phpLogProcess.kill();  // Dödar processen som loggar
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