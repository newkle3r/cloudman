#!/usr/bin/env node
import Table from 'cli-table3';
import { clearConsole, loadVariables, initialize, welcome, UPDATE_THRESHOLD,awaitContinue } from './utils.js';
import { RED, BLUE, GREEN, YELLOW, PURPLE } from './color.js';
import { execSync } from 'child_process';
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
import ncRedisServer from './ncRedisServer.js';

// Initialize global variables
let versions;
let varsclass;
let activeMenu = null;
const linkText = 'Want a professional to just fix it for you? Click here!';
const url = 'https://shop.hanssonit.se/product-category/support/';

/**
 * Initialize variables and statuses, fetch updates where necessary.
 */
async function initializeVariables() {
    versions = new ncRedisServer();
    versions.getPHPVersion();
    varsclass = new ncVARS();
    varsclass.loadVariables();
    

    varsclass.psqlStatus = varsclass.getServiceStatus('postgresql');
    varsclass.redisStatus = varsclass.getServiceStatus('redis-server');
    varsclass.apache2Status = varsclass.getServiceStatus('apache2'); 
    varsclass.dockerStatus = varsclass.getDockerStatus();
    versions.phpversion = versions.getPHPVersion();
    varsclass.phpFPMstatus = varsclass.getServiceStatus(`php${versions.phpversion}-fpm.service`)

     await varsclass.getNCstate();
     varsclass.nextcloudVersion = varsclass.NEXTCLOUD_VERSION; 
     varsclass.nextcloudState = varsclass.NEXTCLOUD_STATUS; 

    // Fetch available app updates
    await initialize(varsclass.getAvailableUpdates.bind(varsclass), 'lastAppUpdateCheck', varsclass, UPDATE_THRESHOLD);
}
/**
 * Main menu system from which all others branch.
 */
async function mainMenu() {
    clearConsole();
    await welcome();

    // Fetch system status information
    //const { DISTRO: version, WANIP4: ipv4, ADDRESS: address, CODENAME: name, PSQLVER: psql } = varsclass;
    const { dockerStatus } = varsclass;
    console.log(dockerStatus);
    async function displaySystemStatus() {
        const hostname = execSync('hostname -f').toString().trim(); // Get the hostname
            // Fetch system status information
        const { DISTRO: version, WANIP4: ipv4, ADDRESS: address, CODENAME: name, PSQLVER: psql } = varsclass;
        const { psqlStatus, redisStatus, apache2Status, phpFPMstatus, nextcloudVersion, nextcloudState  } = varsclass;

    

 
    
        // Create a new table instance with column widths and without headers
        const table = new Table({
            colWidths: [40, 40],  // Adjust column widths to your needs
        });
    
        const ncstatColor = nextcloudState === 'active' ? GREEN(nextcloudState) : RED(nextcloudState);
    
        // Add rows to the table
        table.push(
            [`${BLUE('Hostname:')} ${GREEN(hostname)}`, `${BLUE('WAN:')} ${GREEN(ipv4)}`],
            [`${BLUE('Ubuntu:')} ${YELLOW(version)} { ${name} }`, `${BLUE('LAN:')} ${GREEN(address)}`],
            [`${BLUE('Nextcloud:')} ${YELLOW(nextcloudVersion)} { ${ncstatColor} }`, `${BLUE('apache2:')} ${apache2Status}`],
            [`${BLUE('PostgreSQL')} ${YELLOW(psql)}: ${psqlStatus}`, `${BLUE('PHP:')} ${YELLOW(versions.phpversion)}`],
            [`${BLUE('redis-server:')} ${redisStatus}`, `${BLUE('PHP-FPM:')} ${phpFPMstatus}`],
            [`${BLUE('App updates:')} ${varsclass.appUpdateStatus}`, '']
        );
    
        // Output the table
        console.log(table.toString());
    }
    
    // Call the function to display the status table
    await displaySystemStatus();
    

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
            return dockerManager.manageDocker();

        case 'Manage Redis':
            const redisManager = new ncRedisServer(mainMenu);
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

// Helper function to align text in two columns
function formatTwoColumns(left, right) {
    const padding = 40;  // Adjust this value for more or less spacing
    const leftPadded = left.padEnd(padding, ' ');
    return `${leftPadded}${right}`;
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
