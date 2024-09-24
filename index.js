#!/usr/bin/env node
import { clearConsole, loadVariables, initialize, welcome } from './utils.js';
import { RED, BLUE, GREEN, YELLOW, PURPLE } from './color.js';
import ncAPPS from './ncAPPS.js';
import ncFQDN from './ncFQDN.js';
import ncPHP from './ncPHP.js';
import ncSQL from './ncSQL.js';
import ncDOCKER from './ncDOCKER.js';
import ncUPDATE from './ncUPDATE.js';
import ncBAK from './ncBAK.js';
import ncLDAP from './ncLDAP.js';
import ncREDIS from './ncREDIS.js';
import noVMNC from './nextcloud.js';
import ncTLS from './ncTLS.js';
import ncVARS from './ncVARS.js';
import inquirer from 'inquirer';

// Initialize global variables
let varsclass;
let activeMenu = null;
const linkText = 'Want a professional to just fix it for you? Click here!';
const url = 'https://shop.hanssonit.se/product-category/support/';

/**
 * Initialize variables and statuses, fetch updates where necessary.
 */
async function initializeVariables() {
    // Load variables from the ncVARS class and JSON file
    varsclass = new ncVARS();
    varsclass.loadVariables();

    // Fetch app updates and other system statuses using the initialize function
    await initialize(varsclass.getAvailableUpdates.bind(varsclass), 'lastAppUpdateCheck', varsclass);
}

/**
 * Main menu system from which all others branch.
 */
async function mainMenu() {
    clearConsole();
    await welcome();

    // Fetch system status information
    const { DISTRO: version, WANIP4: ipv4, ADDRESS: address, CODENAME: name, PSQLVER: psql } = varsclass;
    const { psqlStatus, redisStatus, apache2Status, dockerStatus, appUpdateStatus } = varsclass;

    // Display system status in the splash screen
    console.log(dockerStatus);
    console.log(BLUE('LAN:'), GREEN(address));
    console.log(BLUE('WAN:'), GREEN(ipv4));
    console.log(BLUE('Ubuntu:'), YELLOW(version), { name });
    console.log(BLUE('PostgreSQL'), YELLOW(psql), ':', psqlStatus);
    console.log(BLUE('redis-server:'), redisStatus);
    console.log(BLUE('apache2:'), apache2Status);
    console.log(BLUE('App updates:'), appUpdateStatus);
    console.log(``)

    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
                'Update Nextcloud',
                'Repair Nextcloud',
                'Manage PostgreSQL',
                'Manage PHP',
                'Manage DNS/FQDN',
                'Manage LDAP',
                'Manage Nextcloud Apps',
                'Manage Mail',
                'Manage Docker',
                'Manage Redis',
                'Manage TLS',
                'Backup',
                'Exit'
            ],
        }
    ]);

    switch (answers.action) {
        case 'Update Nextcloud':
            const updateManager = new ncUPDATE(mainMenu);
            return updateManager.manageUpdate(exitProgram, varsclass);

        case 'Repair Nextcloud':
            const repairNC = new noVMNC();
            return repairNC.repairNextcloud(mainMenu);

        case 'Manage PostgreSQL':
            const sqlManager = new ncSQL();
            return sqlManager.managePostgreSQL(mainMenu);

        case 'Manage PHP':
            const phpManager = new ncPHP();
            return phpManager.managePHP(mainMenu);
            
        case 'Manage DNS/FQDN':
            const dnsManager = new ncFQDN();
            return dnsManager.manageFQDN(mainMenu);

        case 'Manage LDAP':
            const ldapManager = new ncLDAP();
            if (activeMenu === 'ldap') {
                console.log('Already managing LDAP. Returning to main menu...');
                mainMenu();
                break;
            }
            activeMenu = 'ldap';
            return ldapManager.manageLDAP(mainMenu);

        case 'Manage Nextcloud Apps':
            const appsManager = new ncAPPS();
            appsManager.manageApps(mainMenu);
            break;

        case 'Manage SMTP':
            const mailManager = new ncSMTP();
            return mailManager.manageSMTP(mainMenu);

        case 'Manage Docker':
            const dockerManager = new ncDOCKER();
            return dockerManager.manageDocker(mainMenu, welcome);

        case 'Manage Redis':
            const redisManager = new ncREDIS();
            if (activeMenu === 'redis') {
                console.log('Already managing Redis. Returning to main menu...');
                mainMenu();
                break;
            }
            activeMenu = 'redis';
            await redisManager.manageRedis(mainMenu);
            break;

        case 'Manage TLS':
            const certManager = new ncTLS();
            return certManager.certMenu(mainMenu);

        case 'Backup':
            const backupManager = new ncBAK();
            return backupManager.runBackups(mainMenu);

        case 'Exit':
            exitProgram();
    }
}

/**
 * Clear any active prompts or actions before exiting.
 */
function exitProgram() {
    varsclass.saveVariables('./variables.json');
    resetActiveMenu();  
    console.log('Goodbye!');
    process.exit(0);
}

/**
 * Reset the active menu state.
 */
function resetActiveMenu() {
    activeMenu = null;
}

/**
 * Initialize and run the program.
 */
(async () => {
    await initializeVariables();  
    await mainMenu();             
})();
