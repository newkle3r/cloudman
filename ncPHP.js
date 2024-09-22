import { RED, BLUE, GREEN, YELLOW } from './color.js';
import { spawn } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import fs from 'fs';
import { execSync } from 'child_process';

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
        this.phpLogProcess = null; 
    }

    async managePHP(mainMenu) {
        let continueMenu = true;

        while (continueMenu === true) {
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
                    await this.upgradePHP();
                    break;
                case 'Repair Nextcloud PHP':
                    await this.repairPHP();
                    break;
                case 'Configure PHP-FPM':
                    await this.configurePHPFPM()
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

    async identifyPHP() {
        const spinner = createSpinner('Identifying PHP version...').start();

        try {
            const PHPversionOutput = execSync('php -v').toString().trim();
            const versionMatch = PHPversionOutput.match(/^PHP\s+(\d+\.\d+)/);
            if (!versionMatch) throw new Error('Unable to determine PHP version');

            this.phpVersion = versionMatch[1];

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
     * Downgrades PHP to version 7.4 and configures related components.
     */
    async downgradePHP74() {
        const spinner = createSpinner('Downgrading PHP to version 7.4...').start();

        try {
            const installedPHPVersions = execSync('dpkg-query -l | grep php | grep -E "ii|hi" | cut -d " " -f 3 | grep "^php[0-9]"', { encoding: 'utf8' })
                .split('\n')
                .filter(v => v.trim() !== '');

            spinner.success({ text: chalk.green('Found the following PHP versions installed:') });
            console.log(installedPHPVersions.join('\n'));

            const { versionsToPurge } = await inquirer.prompt([
                {
                    type: 'checkbox',
                    name: 'versionsToPurge',
                    message: 'Select PHP versions to purge (leave empty to purge all versions higher than 7.4):',
                    choices: installedPHPVersions,
                }
            ]);

            spinner.update({ text: 'Purging PHP versions...' });
            if (versionsToPurge.length > 0) {
                execSync(`dpkg-query -l ${versionsToPurge.join(' ')}* | grep -E "ii|hi" | cut -d " " -f 3 | xargs sudo apt-get purge -y`, { stdio: 'inherit' });
            } else {
                execSync('dpkg-query -l php7.[5-9]* php8.* | grep -E "ii|hi" | cut -d " " -f 3 | xargs sudo apt-get purge -y', { stdio: 'inherit' });
            }

            spinner.update({ text: 'Installing PHP 7.4 and necessary modules...' });
            execSync('sudo add-apt-repository -y ppa:ondrej/php', { stdio: 'inherit' });
            execSync('sudo apt-get update', { stdio: 'inherit' });
            execSync(`sudo apt-get install -y php7.4 php7.4-fpm php7.4-bcmath php7.4-bz2 php7.4-cli php7.4-common php7.4-curl php7.4-dev php7.4-fpm php7.4-gd php7.4-gmp php7.4-imap php7.4-intl php7.4-ldap php7.4-mbstring php7.4-opcache php7.4-pgsql php7.4-readline php7.4-soap php7.4-xml php7.4-zip php7.4-redis php7.4-smbclient`, { stdio: 'inherit' });

            await this.configurePHPFPM('7.4');
            execSync('sudo a2enconf php7.4-fpm', { stdio: 'inherit' });
            execSync('sudo systemctl restart apache2 || sudo systemctl restart php7.4-fpm', { stdio: 'inherit' });

            spinner.success({ text: chalk.green('Successfully downgraded to PHP 7.4 and configured Apache!') });

        } catch (error) {
            spinner.error({ text: chalk.red('Failed to downgrade PHP to version 7.4') });
            console.error(error);
        }
    }

    /**
     * Configures PHP-FPM for the specified version, setting up the pool and ensuring the correct socket.
     * @param {string} phpVersion - The PHP version to configure (e.g., '7.4', '8.0')
     */
    async configurePHPFPM(phpVersion) {
        const spinner = createSpinner(`Configuring PHP-FPM for PHP ${phpVersion}...`).start();

        try {
            const phpPoolDir = `/etc/php/${phpVersion}/fpm/pool.d`;
            const poolConfigPath = `${phpPoolDir}/nextcloud.conf`;

            if (!fs.existsSync(phpPoolDir)) throw new Error(`PHP-FPM pool directory not found: ${phpPoolDir}`);

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
env[HOSTNAME] = $(hostname -f)
env[PATH] = /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin
env[TMP] = /tmp
env[TMPDIR] = /tmp  
env[TEMP] = /tmp
security.limit_extensions = .php
php_admin_value[cgi.fix_pathinfo] = 1
            `;

            fs.writeFileSync(poolConfigPath, poolConfigContent, 'utf8');
            spinner.success({ text: chalk.green(`PHP-FPM pool configuration updated for PHP ${phpVersion}.`) });

            execSync(`sudo systemctl restart php${phpVersion}-fpm`, { stdio: 'inherit' });
            spinner.success({ text: chalk.green(`PHP-FPM service restarted for PHP ${phpVersion}.`) });

        } catch (error) {
            spinner.error({ text: chalk.red('Failed to configure PHP-FPM.') });
            console.error(error);
        }
    }

    /**
     * @function repairPHP
     * @description Reparerar PHP-installationen för Nextcloud med ytterligare PHP- och PECL-moduler.
     * @returns {Promise<void>}
     */
    async repairPHP() {
        const spinner = createSpinner('Repairing PHP installation...').start();

        try {
            // Load the PHP version from variables.json
            const variables = JSON.parse(fs.readFileSync('variables.json', 'utf8'));
            const PHPVER = variables.PHP;

            if (!PHPVER) throw new Error('PHP version not specified in variables.json.');

            // Uninstall previous PHP versions
            execSync('sudo apt-get purge php* -y && sudo apt-get autoremove -y && sudo rm -Rf /etc/php', { stdio: 'inherit' });
            spinner.update({ text: 'Removed old PHP versions...' });

            // Install required PHP packages
            execSync(`sudo apt-get update && sudo apt-get install -y php${PHPVER}-fpm php${PHPVER}-intl php${PHPVER}-ldap php${PHPVER}-imap php${PHPVER}-gd php${PHPVER}-pgsql php${PHPVER}-curl php${PHPVER}-xml php${PHPVER}-zip php${PHPVER}-mbstring php${PHPVER}-soap php${PHPVER}-gmp php${PHPVER}-bz2 php${PHPVER}-bcmath php-pear`, { stdio: 'inherit' });
            spinner.update({ text: `Installed PHP ${PHPVER} and necessary modules...` });

            // Set PHP as default using update-alternatives
            execSync(`sudo update-alternatives --set php /usr/bin/php${PHPVER}`);
            execSync(`sudo update-alternatives --set phpize /usr/bin/phpize${PHPVER}`);
            execSync(`sudo update-alternatives --set php-config /usr/bin/php-config${PHPVER}`);
            spinner.update({ text: 'Set PHP version in Ubuntu...' });

            // Enable PHP-FPM configuration in Apache
            execSync(`sudo a2enconf php${PHPVER}-fpm`, { stdio: 'inherit' });
            spinner.update({ text: 'Enabled PHP-FPM configuration in Apache...' });

            // Enable HTTP/2 with H2Direct
            const HTTP2_CONF = '/etc/apache2/conf-available/http2.conf';
            fs.writeFileSync(HTTP2_CONF, `
<IfModule http2_module>
    Protocols h2 http/1.1
    H2Direct on
</IfModule>
            `);
            execSync('sudo a2enmod http2 && sudo systemctl restart apache2', { stdio: 'inherit' });
            spinner.update({ text: 'Enabled HTTP/2 with H2Direct in Apache...' });

            // PHP-FPM Pool Configuration for Nextcloud
            const PHP_POOL_DIR = `/etc/php/${PHPVER}/fpm/pool.d`;
            fs.writeFileSync(`${PHP_POOL_DIR}/nextcloud.conf`, `
[Nextcloud]
user = www-data
group = www-data
listen = /run/php/php${PHPVER}-fpm.nextcloud.sock
listen.owner = www-data
listen.group = www-data
pm = dynamic
pm.max_children = 8
pm.start_servers = 3
pm.min_spare_servers = 2
pm.max_spare_servers = 3
env[HOSTNAME] = $(hostname -f)
env[PATH] = /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin
env[TMP] = /tmp
env[TMPDIR] = /tmp
env[TEMP] = /tmp
security.limit_extensions = .php
php_admin_value[cgi.fix_pathinfo] = 1
            `);
            execSync(`sudo mv ${PHP_POOL_DIR}/www.conf ${PHP_POOL_DIR}/www.conf.backup && sudo systemctl restart php${PHPVER}-fpm`, { stdio: 'inherit' });
            spinner.update({ text: 'Configured PHP-FPM pool for Nextcloud...' });

            // Install and configure PECL modules (smbclient, igbinary)
            execSync(`sudo apt-get install -y php${PHPVER}-dev libsmbclient-dev`, { stdio: 'inherit' });
            execSync(`yes no | sudo pecl install smbclient igbinary`, { stdio: 'inherit' });
            const PHP_MODS_DIR = `/etc/php/${PHPVER}/mods-available`;
            fs.writeFileSync(`${PHP_MODS_DIR}/smbclient.ini`, 'extension=smbclient.so');
            fs.writeFileSync(`${PHP_MODS_DIR}/igbinary.ini`, 'extension=igbinary.so');
            execSync(`sudo phpenmod -v ALL smbclient igbinary`, { stdio: 'inherit' });
            spinner.update({ text: 'Installed and configured smbclient and igbinary PECL modules...' });

            // Update php.ini with performance settings
            const PHP_INI = `/etc/php/${PHPVER}/fpm/php.ini`;
            fs.appendFileSync(PHP_INI, `
max_execution_time = 3500
max_input_time = 3600
memory_limit = 512M
post_max_size = 1100M
upload_max_filesize = 1000M
            `);
            spinner.update({ text: 'Updated php.ini with performance settings...' });

            // Enable OPCache for PHP
            fs.appendFileSync(PHP_INI, `
opcache.enable=1
opcache.enable_cli=1
opcache.interned_strings_buffer=8
opcache.max_accelerated_files=10000
opcache.memory_consumption=256
opcache.save_comments=1
opcache.revalidate_freq=1
opcache.validate_timestamps=1
            `);
            execSync(`sudo phpenmod opcache`, { stdio: 'inherit' });
            spinner.update({ text: 'Enabled OPCache for PHP...' });

            // PHP-FPM Optimizations
            const PHP_FPM_CONF = `/etc/php/${PHPVER}/fpm/php-fpm.conf`;
            execSync(`sudo sed -i "s|;emergency_restart_threshold.*|emergency_restart_threshold = 10|g" ${PHP_FPM_CONF}`, { stdio: 'inherit' });
            execSync(`sudo sed -i "s|;emergency_restart_interval.*|emergency_restart_interval = 1m|g" ${PHP_FPM_CONF}`, { stdio: 'inherit' });
            execSync(`sudo sed -i "s|;process_control_timeout.*|process_control_timeout = 10|g" ${PHP_FPM_CONF}`, { stdio: 'inherit' });
            spinner.update({ text: 'Applied PHP-FPM optimizations...' });

            // Configure Redis for Nextcloud caching
            execSync('sudo apt-get install redis-server -y', { stdio: 'inherit' });
            execSync('nextcloud_occ config:system:set memcache.local --value="\\OC\\Memcache\\Redis"', { stdio: 'inherit' });
            spinner.update({ text: 'Configured Redis caching for Nextcloud...' });

            // Remove maintenance mode
            execSync('nextcloud_occ maintenance:mode --off', { stdio: 'inherit' });
            spinner.update({ text: 'Exited maintenance mode...' });

            // Restart Apache and PHP-FPM
            execSync(`sudo systemctl restart apache2 php${PHPVER}-fpm`, { stdio: 'inherit' });

            spinner.success({ text: `${GREEN('PHP installation and configuration repaired successfully!')}` });
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

    this.phpLogProcess = spawn('sudo', ['tail', '-f', phpLogFile], { stdio: 'inherit' });

    this.phpLogProcess.on('error', (error) => {
        console.error(`${RED('Error tailing logs:')} ${error.message}`);
        this.phpLogProcess = null;
    });

    // Handle process closure
    this.phpLogProcess.on('close', () => {
        console.log(chalk.green('PHP log tailing stopped.'));
        this.phpLogProcess = null;
    });

    // Gracefully handle Ctrl+C (SIGINT) to stop tailing
    process.on('SIGINT', () => {
        if (this.phpLogProcess) {
            this.stopTailPHPlogs();
        }
    });
}

/**
 * @function stopTailPHPlogs
 * @description Stoppar loggning av PHP-loggar i realtid.
 */
stopTailPHPlogs() {
    if (this.phpLogProcess) {
        console.log(chalk.yellow('Stopping PHP log tailing...'));
        this.phpLogProcess.kill('SIGTERM');  // Gracefully terminate the process
        this.phpLogProcess = null;
    } else {
        console.log(chalk.red('No PHP log tailing process is running.'));
    }
}
}
export default ncPHP;