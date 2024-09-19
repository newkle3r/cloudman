import chalk from 'chalk';
import inquirer from 'inquirer';
import gradient from 'gradient-string';
import chalkAnimation from 'chalk-animation';
import figlet from 'figlet';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process';  // For executing shell commands

const RED = chalk.redBright;
const BLUE = chalk.blue;
const GREEN = chalk.green;
const YELLOW = chalk.yellow;
const GRAYLI = chalk.bgGrey;
const GRAY = chalk.gray;
const YELLOWLI = chalk.bgYellowBright;
const PURPLE = chalk.magenta;


/**
 * Displays a menu for PHP management tasks such as identifying the PHP version, downgrading, upgrading, repairing Nextcloud PHP, and managing PHP logs.
 * Prompts the user to select an action and invokes the corresponding function based on the selection.
 * 
 * @returns {Promise<void>} Promises to handle user input and manage PHP based on the action selected.
 */

async function managePHP() {
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
                'Print PHP logs',
                'Go Back'
            ],
        }
    ]);

    switch (answers.action) {
        case 'Identify Version':
            return identifyPHP();
        case 'Downgrade to php7.4':
            return downgradePHP74();
        case 'Repair Nextcloud PHP':
            return repairPHP();
        case 'Tail PHP logs':
            return tailPHPlogs();
        case 'Print PHP logs':
            return printPHPlogs();
        case 'Go Back':
            return mainMenu();
    }
}


/**
 * Identifies the currently installed PHP version by executing the 'php -v' command
 * and updates the 'PHP' variable in variables.json with the identified version.
 */
async function identifyPHP() {
    const spinner = createSpinner('Identifying PHP version...').start();

    try {
        // Execute 'php -v' to get the version information
        const PHPversionOutput = execSync('php -v').toString().trim();
        
        // Extract the version number (e.g., "7.4", "8.1") from the output
        const versionMatch = PHPversionOutput.match(/^PHP\s+(\d+\.\d+)/);
        if (!versionMatch) {
            throw new Error('Unable to determine PHP version');
        }

        const PHPversion = versionMatch[1]; // Extracted version in format x.x
        
        // Update variables.json
        const variablesPath = 'variables.json';
        let variables = {};

        if (fs.existsSync(variablesPath)) {
            variables = JSON.parse(fs.readFileSync(variablesPath, 'utf8'));
        }

        variables.PHP = PHPversion; // Update the PHP version

        // Write updated variables back to variables.json
        fs.writeFileSync(variablesPath, JSON.stringify(variables, null, 2), 'utf8');

        spinner.success({ text: `${GREEN('PHP Version Identified and Updated:')}\n${PHPversion}` });
    } catch (error) {
        spinner.error({ text: `${RED('Failed to identify and update PHP version')}` });
        console.error(error);
    }
}

export { identifyPHP };

/**
 * Downgrades the currently installed PHP 8.x version to PHP 7.4.
 */
async function downgradePHP74() {
    const spinner = createSpinner('Downgrading PHP to version 7.4...').start();

    try {
        // 1. Identify and remove installed PHP 8.x packages
        execSync('dpkg-query -l php8.1* | grep -E "ii|hi" | cut -d " " -f 3 | xargs sudo apt-get purge -y');

        // 2. Add the ondrej/php repository if it's not already added
        try {
            execSync('add-apt-repository -y ppa:ondrej/php');
        } catch (error) {
            console.error(RED('ondrej/php repository already added or failed to add.'));
        }

        // 3. Update package lists
        execSync('sudo apt-get update');

        // 4. Install PHP 7.4 and required packages for Nextcloud
        execSync('sudo apt-get install -y php7.4 php7.4-bcmath php7.4-bz2 php7.4-cli php7.4-common php7.4-curl php7.4-dev php7.4-fpm php7.4-gd php7.4-gmp php7.4-imap php7.4-intl php7.4-ldap php7.4-mbstring php7.4-opcache php7.4-pgsql php7.4-readline php7.4-soap php7.4-xml php7.4-zip php7.4-redis php7.4-smbclient');

        // 5. Restart Apache and PHP-FPM service
        execSync('sudo systemctl restart apache2 || sudo systemctl restart php7.4-fpm');

        spinner.success({ text: `${GREEN('Successfully downgraded PHP to version 7.4')}` });
    } catch (error) {
        spinner.error({ text: `${RED('Failed to downgrade PHP to version 7.4')}` });
        console.error(error);
    }
}

export { downgradePHP74 };

/**
 * Repairs the PHP installation for Nextcloud using the p.sh script as a template.
 * Uses the 'PHP' version specified in the variables.json.
 */
async function repairPHP() {
    const spinner = createSpinner('Repairing PHP installation...').start();

    try {
        // Load the PHP version from variables.json
        const variables = JSON.parse(fs.readFileSync('variables.json', 'utf8'));
        const PHPVER = variables.PHP;

        if (!PHPVER) {
            throw new Error('PHP version not specified in variables.json.');
        }

        // 1. Enter maintenance mode
        execSync('sudo -u www-data php /var/www/nextcloud/occ maintenance:mode --on');
        spinner.update({ text: 'Entered maintenance mode...' });

        // 2. Stop Apache2
        execSync('sudo systemctl stop apache2.service');
        spinner.update({ text: 'Stopped Apache2...' });

        // 3. Uninstall Apache2
        execSync('sudo apt-get purge apache2* -y');
        execSync('sudo apt-get autoremove -y');
        execSync('sudo apt-get clean');
        spinner.update({ text: 'Uninstalled Apache2...' });

        // 4. Install Apache2 and required modules
        execSync('sudo apt-get install -y apache2');
        execSync('sudo a2enmod rewrite headers proxy proxy_fcgi setenvif env mime dir authz_core alias mpm_event ssl');
        execSync('sudo a2dismod mpm_prefork');
        spinner.update({ text: 'Installed and configured Apache2...' });

        // 5. Add ondrej/php repository and install PHP
        execSync('add-apt-repository -y ppa:ondrej/php');
        execSync('sudo apt-get update');
        execSync(`sudo apt-get install -y php${PHPVER}-fpm php${PHPVER}-bcmath php${PHPVER}-bz2 php${PHPVER}-cli php${PHPVER}-common php${PHPVER}-curl php${PHPVER}-dev php${PHPVER}-gd php${PHPVER}-gmp php${PHPVER}-imap php${PHPVER}-intl php${PHPVER}-ldap php${PHPVER}-mbstring php${PHPVER}-opcache php${PHPVER}-pgsql php${PHPVER}-readline php${PHPVER}-soap php${PHPVER}-xml php${PHPVER}-zip php${PHPVER}-redis php${PHPVER}-smbclient`);
        spinner.update({ text: 'Installed PHP and required modules...' });

        // 6. Configure Apache2 to use PHP-FPM
        execSync(`sudo a2enconf php${PHPVER}-fpm`);
        spinner.update({ text: 'Configured PHP-FPM for Apache2...' });

        // 7. Enable HTTP/2
        execSync('echo "<IfModule http2_module>\\n    Protocols h2 http/1.1\\n    H2Direct on\\n</IfModule>" | sudo tee /etc/apache2/conf-available/http2.conf');
        execSync('sudo a2enmod http2');
        execSync('sudo systemctl restart apache2');
        spinner.update({ text: 'Enabled HTTP/2...' });

        // 8. Enable PHP modules and optimize PHP configuration
        execSync(`sudo phpenmod opcache`);
        execSync(`sudo sed -i "s|max_execution_time =.*|max_execution_time = 3500|g" /etc/php/${PHPVER}/fpm/php.ini`);
        execSync(`sudo sed -i "s|max_input_time =.*|max_input_time = 3600|g" /etc/php/${PHPVER}/fpm/php.ini`);
        execSync(`sudo sed -i "s|memory_limit =.*|memory_limit = 512M|g" /etc/php/${PHPVER}/fpm/php.ini`);
        execSync(`sudo sed -i "s|post_max_size =.*|post_max_size = 1100M|g" /etc/php/${PHPVER}/fpm/php.ini`);
        execSync(`sudo sed -i "s|upload_max_filesize =.*|upload_max_filesize = 1000M|g" /etc/php/${PHPVER}/fpm/php.ini`);
        spinner.update({ text: 'Optimized PHP configuration...' });

        // 9. Restart Apache2 and PHP-FPM
        execSync('sudo systemctl restart apache2');
        execSync(`sudo systemctl restart php${PHPVER}-fpm`);
        spinner.update({ text: 'Restarted Apache2 and PHP-FPM...' });

        // 10. Exit maintenance mode
        execSync('sudo -u www-data php /var/www/nextcloud/occ maintenance:mode --off');
        spinner.success({ text: `${GREEN('PHP installation repaired successfully!')}` });
    } catch (error) {
        spinner.error({ text: `${RED('Failed to repair PHP installation')}` });
        console.error(error);
    }
}

export { repairPHP };