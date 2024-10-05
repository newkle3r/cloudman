import inquirer from 'inquirer';
import { clearConsole,welcome } from './utils.js';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { createSpinner } from 'nanospinner';
import ncUPDATE from './ncUPDATE';
import ncFQDN from './ncFQDN';
import ncVARS from './ncVARS.js';

/**
 * @class ncSETUP
 * @example
 * @classdesc
 * @augments
 * 
 * @description Class responsible for configuring Nextcloud settings. This includes settings for Cookie Lifetime, Share folder, Disabling Workspaces, User Flows, Logrotate, and more.
 */

class ncSETUP extends ncREPAIR {
    constructor() {
        let lib = new ncVARS();
        this.upvar = lib.loadVariables(variable)
        this.downvar = lib.saveVariables(variable)
        this.updatevar = lib.updateVariable(variable)
        this.printVar = lib.printVariables(variable)
    }
    /**
     * @function configureNextcloud
     * @description Displays a configuration menu for Nextcloud settings and applies user choices.
     * @returns {Promise<void>}
     */
    async configureNextcloud() {
        const spinner = createSpinner('Loading configuration menu...').start();

        try {
            // Prompt user for configuration options
            const choices = await inquirer.prompt([
                {
                    type: 'checkbox',
                    name: 'settings',
                    message: 'Which settings do you want to configure?',
                    choices: [
                        { name: 'CookieLifetime (Set forced logout timeout)', value: 'CookieLifetime' },
                        { name: 'Share-folder (Enable "Shared" folder for shares)', value: 'ShareFolder' },
                        { name: 'Disable workspaces (Disable top notes in GUI)', value: 'DisableWorkspaces' },
                        { name: 'Disable user flows (Disable Nextcloud user flows)', value: 'DisableUserFlows' },
                        { name: 'Check 0-Byte files (Check for empty/corrupted files)', value: 'Check0ByteFiles' },
                        { name: 'Update mimetype list (Update mimetypes)', value: 'UpdateMimetype' },
                        { name: 'Enable logrotate (Keep logs for 10 days)', value: 'EnableLogrotate' }
                    ]
                }
            ]);

            spinner.stop();

            // Apply user choices
            if (choices.settings.includes('CookieLifetime')) {
                await this.configureCookieLifetime();
            }
            if (choices.settings.includes('ShareFolder')) {
                await this.configureShareFolder();
            }
            if (choices.settings.includes('DisableWorkspaces')) {
                await this.disableWorkspaces();
            }
            if (choices.settings.includes('DisableUserFlows')) {
                await this.disableUserFlows();
            }
            if (choices.settings.includes('Check0ByteFiles')) {
                await this.checkZeroByteFiles();
            }
            if (choices.settings.includes('UpdateMimetype')) {
                await this.updateMimetype();
            }
            if (choices.settings.includes('EnableLogrotate')) {
                await this.enableLogrotate();
            }

            console.log(chalk.green('Configuration complete!'));
        } catch (error) {
            spinner.stop();
            console.error(chalk.red('Error in configuring Nextcloud:'), error);
        }
    }

    /**
     * @function configureCookieLifetime
     * @description Configures the forced logout timeout for users in Nextcloud.
     * @returns {Promise<void>}
     */
    async configureCookieLifetime() {
        console.log(chalk.cyan('Configuring CookieLifetime...'));
        execSync('bash /var/scripts/addons/cookielifetime.sh'); // Executes the relevant script for CookieLifetime
        console.log(chalk.green('CookieLifetime configured successfully!'));
    }

    /**
     * @function configureShareFolder
     * @description Configures the "Shared" folder for Nextcloud shares.
     * @returns {Promise<void>}
     */
    async configureShareFolder() {
        console.log(chalk.cyan('Configuring Share-folder...'));
        execSync("sudo -u www-data php /var/www/nextcloud/occ config:system:set share_folder --value='/Shared'");
        console.log(chalk.green('Share-folder configured successfully!'));
    }

    /**
     * @function disableWorkspaces
     * @description Disables the "Rich Workspaces" feature in Nextcloud, which shows top notes in the GUI.
     * @returns {Promise<void>}
     */
    async disableWorkspaces() {
        console.log(chalk.cyan('Disabling Rich Workspaces...'));
        const isTextAppEnabled = execSync('sudo -u www-data php /var/www/nextcloud/occ app:list | grep text').toString().trim();
        if (isTextAppEnabled) {
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:app:set text workspace_available --value=0');
            console.log(chalk.green('Rich Workspaces disabled successfully!'));
        } else {
            console.log(chalk.red('The text app is not enabled. Cannot disable workspaces.'));
        }
    }

    /**
     * @function disableUserFlows
     * @description Disables user-specific flows in Nextcloud while keeping admin flows active.
     * @returns {Promise<void>}
     */
    async disableUserFlows() {
        const currentVersion = execSync('sudo -u www-data php /var/www/nextcloud/occ status | grep versionstring').toString().split(':')[1].trim();
        console.log(chalk.cyan('Disabling User Flows...'));
        if (currentVersion >= "18.0.4") {
            execSync('sudo -u www-data php /var/www/nextcloud/occ config:app:set workflowengine user_scope_disabled --value=yes');
            console.log(chalk.green('User flows disabled successfully!'));
        } else {
            console.log(chalk.red('User flows can only be disabled on Nextcloud 18.0.4 and above.'));
        }
    }

    /**
     * @function checkZeroByteFiles
     * @description Checks for empty or corrupted (0-byte) files in Nextcloud.
     * @returns {Promise<void>}
     * @module
     */
    async checkZeroByteFiles() {
        console.log(chalk.cyan('Checking for 0-byte files...'));
        execSync('bash /var/scripts/addons/0-byte-files.sh');
        console.log(chalk.green('0-byte file check complete.'));
    }

    /**
     * @function updateMimetype
     * @description Updates Nextcloud's internal mimetype database.
     * 
     */
    async updateMimetype() {
        console.log(chalk.cyan('Updating mimetype database...'));
        execSync('sudo -u www-data php /var/www/nextcloud/occ maintenance:mimetype:update-js');
        execSync('sudo -u www-data php /var/www/nextcloud/occ maintenance:mimetype:update-db');
        console.log(chalk.green('Mimetype database updated successfully!'));
    }

    /**
     * @function enableLogrotate
     * @description Enables logrotate for Nextcloud, keeping logs for 10 days.
     * @returns {Promise<void>}
     */
    async enableLogrotate() {
        console.log(chalk.cyan('Enabling logrotate for Nextcloud logs...'));
        execSync('sudo -u www-data php /var/www/nextcloud/occ config:system:set log_rotate_size --value=0');
        const logrotateConfig = `
        /var/log/nextcloud.log {
            daily
            rotate 10
            copytruncate
        }
        /var/log/audit.log {
            daily
            rotate 10
            copytruncate
        }`;
        fs.writeFileSync('/etc/logrotate.d/nextcloud.log.conf', logrotateConfig);
        execSync('chown www-data:www-data /var/log/');
        console.log(chalk.green('Logrotate enabled successfully!'));
    }
}

// Main entry point to run the configuration
(async () => {
    const updater = new ncSETUP();
    await updater.configureNextcloud();
})();

export default ncSETUP;

// ===================== LIB TRANSLATE ========================= //

/**
 * @function check_universe
 * @description Kontrollerar om "universe" repository är tillagt och lägger till det om det saknas.
 * @returns {void} Returnerar inget värde men utför kommandon för att lägga till "universe"-repo om det saknas.
 */
function check_universe() {
    const universeRepo = execSync("apt-cache policy | grep http | awk '{print $3}' | grep universe | head -n 1 | cut -d '/' -f 2").toString().trim();
    if (universeRepo !== "universe") {
        console.log("Lägger till required repo (universe).");
        execSync("add-apt-repository universe");
    }
}

/**
 * @function set_max_count
 * @description Sätter maximalt antal virtuella minneskartor som stöds av Docker för Elasticsearch.
 * @returns {void} Utför sysctl-ändringar för att öka vm.max_map_count.
 */
function set_max_count() {
    const isMaxSet = execSync("grep -F 'vm.max_map_count=512000' /etc/sysctl.conf").toString().trim();
    if (!isMaxSet) {
        execSync("sysctl -w vm.max_map_count=512000");
        fs.appendFileSync('/etc/sysctl.conf', `
        ###################################################################
        # Docker ES max virtual memory
        vm.max_map_count=512000
        `);
    } else {
        console.log("Max map count redan inställt, hoppar över...");
    }
}

/**
 * @function remove_collabora_docker
 * @description Avinstallerar Collabora-dockerkontainern och dess relaterade konfigurationer, inklusive SSL-certifikat och Apache-inställningar.
 * @returns {void} Utför borttagning av Collabora relaterade konfigurationer.
 */
function remove_collabora_docker() {
    dockerPrune('collabora/code');
    const subdomain = prompt("Ange subdomänen du använder för Collabora, t.ex: office.dindomän.com");
    const certFile = `/etc/letsencrypt/live/${subdomain}/cert.pem`;
    if (fs.existsSync(certFile)) {
        execSync(`certbot revoke --cert-path ${certFile}`);
        fs.readdirSync('/etc/letsencrypt/live').forEach(file => {
            if (file.startsWith(subdomain)) fs.rmSync(file);
        });
    }
    const siteAvailable = `/etc/apache2/sites-available/${subdomain}.conf`;
    if (fs.existsSync(siteAvailable)) {
        execSync(`a2dissite ${subdomain}.conf`);
        execSync('systemctl restart apache2');
        fs.rmSync(siteAvailable);
    }
    // Ta bort Collabora-appen i Nextcloud om den är aktiverad.
    if (isAppInstalled('richdocuments')) {
        execSync('nextcloud_occ app:remove richdocuments');
    }
    remove_from_trusted_domains(subdomain);
}

/**
 * @function check_php
 * @description Hämtar och sätter den nuvarande PHP-versionen och exporterar den för vidare användning.
 * @returns {void} Sätter PHP-versionen i en miljövariabel som exporteras för andra processer.
 */
function check_php() {
    
    console.log("Hämtar nuvarande PHP-version...");
    const phpVersion = execSync('php -v | grep -m 1 PHP | awk \'{print $2}\' | cut -d \'-\' -f1').toString().trim();
    if (!phpVersion) {
        throw new Error("Kan inte hitta korrekt PHP-version, avbryter...");
    }

    let phpVerEnv;
    if (phpVersion.startsWith('7.4')) {
        phpVerEnv = '7.4';
    } else if (phpVersion.startsWith('8.1')) {
        phpVerEnv = '8.1';
    }

    process.env.PHPVER = phpVerEnv;
    console.log(`PHP-version är: ${phpVerEnv}`);
}

/**
 * @function add_trusted_key_and_repo
 * @description Lägger till en pålitlig nyckel och ett repository för apt-baserade installationer.
 * @param {string} keyFile - Nyckelfilen som ska läggas till.
 * @param {string} keyUrl - URL till nyckeln som ska hämtas.
 * @param {string} repoUrl - URL till repositoryn som ska läggas till.
 * @param {string} codename - Kodnamn för distributionen.
 * @param {string} listFile - Filen där repo-informationen lagras.
 * @returns {void} Lägger till ett repository och uppdaterar apt.
 */
function add_trusted_key_and_repo(keyFile, keyUrl, repoUrl, codename, listFile) {
    const distroVersion = process.env.DISTRO_VERSION;
    if (distroVersion === '22.04') {
        console.log(`Lägger till pålitlig nyckel i /etc/apt/keyrings/${keyFile}...`);
        execSync(`curl -sL ${keyUrl}/${keyFile} | tee -a /etc/apt/keyrings/${keyFile}`);
        fs.writeFileSync(`/etc/apt/sources.list.d/${listFile}`, `deb [signed-by=/etc/apt/keyrings/${keyFile}] ${repoUrl} ${codename}`);
        execSync('apt-get update');
    } else if (distroVersion === '20.04') {
        console.log('Lägger till pålitlig nyckel med apt-key...');
        execSync(`curl -sL ${keyUrl}/${keyFile} | apt-key add -`);
        fs.writeFileSync(`/etc/apt/sources.list.d/${listFile}`, `deb ${repoUrl} ${codename}`);
        execSync('apt-get update');
    }
}

