#!/usr/bin/env node
import Table from 'cli-table3';
import ncUTILS from './ncUTILS.js';
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
import ncUX from './ncUX.js';
import ncTLS from './ncTLS.js';
import ncVARS from './ncVARS.js';
import inquirer from 'inquirer';
import ncREPAIR from './ncREPAIR.js';
import ncRedisServer from './ncRedisServer.js';

// Initialize global variables
let redisServ = new ncRedisServer();
let util = new ncUTILS();
let lib = new ncVARS();
let ux = new ncUX();
let bak = new ncBAK();
let modTime = bak.timestamp;
let formattedTimestamp = bak.formatBackupTimestamp(modTime);
const phpVersion = redisServ.getPHPVersion();

const UPDATE_THRESHOLD = lib.UPDATE_THRESHOLD;
let activeMenu = null;
const linkText = 'Want a professional to just fix it for you? Click here!';
const url = 'https://shop.hanssonit.se/product-category/support/';

/**
 * Initialize variables and statuses, fetch updates where necessary.
 */
async function initializeVariables() {



    try {
        lib.loadVariables(RED);
        lib.updateVariable(lib.PHPVER, phpVersion);
        lib.getAvailableUpdates();
    
        lib.redisStatus = lib.getServiceStatus('redis-server');
        lib.apache2Status = lib.getServiceStatus('apache2');
        lib.phpfpmStatus = lib.getServiceStatus(`php${phpVersion}-fpm.service`);
    
        const ncStateAndVersion = await lib.getNCstate();
        lib.nextcloudState = ncStateAndVersion.state;
        lib.nextcloudVersion = ncStateAndVersion.version;
    
        await util.initialize(lib.getAvailableUpdates.bind(lib), 'lastAppUpdateCheck', lib, UPDATE_THRESHOLD);
    } catch (error) {
        console.error('Error initializing variables:', error);
        process.exit(1);  // Terminate if critical error occurs
    }
}

/**
 * Main menu system from which all others branch.
 */
async function mainMenu() {
    // console.log('Displaying main menu...');
    await ux.welcome();

    const { DISTRO: version, WANIP4: ipv4, ADDRESS: address, CODENAME: name, PSQLVER: psql } = lib;
    console.log(`${lib.getDockerStatus()}`);

    async function displaySystemStatus() {

        // console.log(`The function counter in the beginning:${YELLOW(lib.countFunc)} `);
        // console.log('Displaying system status...');
        const hostname = execSync('hostname -f').toString().trim();


        const table = new Table({
            colWidths: [40, 40],  
        });

        
   
        


        table.push(
            [`${BLUE('Hostname:')} ${GREEN(hostname)}`, `${BLUE('WAN:')} ${GREEN(ipv4)}`],
            [`${BLUE('Ubuntu:')} ${YELLOW(version)} ${YELLOW('{')} ${GREEN(name)} ${YELLOW('}')}`, `${BLUE('LAN:')} ${GREEN(address)}`],
            [`${BLUE('Nextcloud:')} ${YELLOW(lib.nextcloudVersion)} ${YELLOW('{')} ${GREEN(lib.nextcloudState)} ${YELLOW('}')}`, `${BLUE('apache2:')} ${lib.apache2Status}`],
            [`${BLUE('PostgreSQL:')} ${YELLOW(`${lib.getPostgresVersion()}`)}`, `${BLUE('PHP:')} ${YELLOW(phpVersion)}`],
            [`${BLUE('PHP-FPM:')} ${lib.phpfpmStatus}`, `${BLUE('redis-server:')} ${lib.redisStatus}`],
            [`${BLUE('App updates:')} ${lib.appUpdateStatus}`, `${BLUE('Last Backup:')} ${YELLOW(formattedTimestamp)}`]
        );

        console.log(table.toString());
    }

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

    console.log('Exiting program...');
    lib.saveVariables('./variables.json');
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
