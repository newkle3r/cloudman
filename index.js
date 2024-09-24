#!/usr/bin/env node
import { clearConsole, loadVariables, initialize, welcome, UPDATE_THRESHOLD,awaitContinue } from './utils.js';
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
import ncREPAIR from './ncREPAIR.js';

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
    await initialize(varsclass.getAvailableUpdates.bind(varsclass), 'lastAppUpdateCheck', varsclass, UPDATE_THRESHOLD);
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
            return updateManager.manageUpdate();

        case 'Repair Nextcloud':
            const repairNC = new ncREPAIR(mainMenu);
            return repairNC.manageRepair();

        case 'Manage PostgreSQL':
            const sqlManager = new ncSQL(mainMenu);
            return sqlManager.managePostgreSQL();

        case 'Manage PHP':
            const phpManager = new ncPHP(mainMenu);
            return phpManager.managePHP();
            
        case 'Manage DNS/FQDN':
            const dnsManager = new ncFQDN(mainMenu);
            return dnsManager.manageFQDN();

        case 'Manage LDAP':
            const ldapManager = new ncLDAP(mainMenu);
            if (activeMenu === 'ldap') {
                console.log('Already managing LDAP. Returning to main menu...');
                mainMenu();
                break;
            }
            activeMenu = 'ldap';
            return ldapManager.manageLDAP();

        case 'Manage Nextcloud Apps':
            const appsManager = new ncAPPS(mainMenu);
            appsManager.manageApps();
            break;

        case 'Manage SMTP':
            const mailManager = new ncSMTP(mainMenu);
            return mailManager.manageSMTP();

        case 'Manage Docker':
            const dockerManager = new ncDOCKER(mainMenu);
            return dockerManager.manageDocker(welcome);

        case 'Manage Redis':
            const redisManager = new ncREDIS(mainMenu);
            if (activeMenu === 'redis') {
                console.log('Already managing Redis. Returning to main menu...');
                mainMenu();
                break;
            }
            activeMenu = 'redis';
            await redisManager.manageRedis();
            break;

        case 'Manage TLS':
            const certManager = new ncTLS(mainMenu);
            certManager.verifyVariables();
            await awaitContinue();
            return certManager.certMenu();

        case 'Backup':
            const backupManager = new ncBAK(mainMenu);
            return backupManager.runBackups();

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
