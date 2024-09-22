#!/usr/bin/env node
import { RED,BLUE,GRAY,GRAYLI,GREEN,YELLOW,YELLOWLI,PURPLE } from './color.js';

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
// import { getAvailableUpdates } from 'ncAPPS.js';  // Ensure your file is named 'ncAPPS.js' with the `.js` extension
import ncVARS from './ncVARS.js';




import fs from 'fs';
import chalk, { colorNames } from 'chalk';
import chalkAnimation from 'chalk-animation';
import gradient from 'gradient-string';
import figlet from 'figlet';
import { execSync } from 'child_process';
import inquirer from 'inquirer';



async function sleep(ms = 2000) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkComponent(command) {
    try {
        execSync(command);
        return true; 
    } catch (error) {
        return false; 
    }
}
function loadVariables() {
    try {
        const data = fs.readFileSync('./variables.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading variables.json:', error);
        return {};
    }
}

  // Load variables from variables.json
  const varsclass = new ncVARS();
  const vars = loadVariables();
  

  
  const version = varsclass.DISTRO;
  const ipv4 = varsclass.WANIP4;
  const address = varsclass.ADDRESS;
  const name = varsclass.CODENAME;
  const psql = vars.PSQLVER; // "14"
  const psqlStatus = varsclass.psqlStatus; 
  const redisStatus = varsclass.redisStatus;
  const apache2Status = varsclass.apache2Status;
  const SMTPStatus = varsclass.SMTPStatus;
  const dockerStatus = varsclass.dockerStatus;
  const appUpdates = varsclass.getAvailableUpdates;
  

  
  
  
  
  
  


async function welcome() {



    const rainbowTitle = chalkAnimation.rainbow(
        'Nextcloud instance manager by T&M Hansson IT \n');
    
    await sleep();
    rainbowTitle.stop();
    
    
    console.log(
        gradient.pastel.multiline(
            figlet.textSync('Cloudman', { horizontalLayout: 'full' })
        )
    );
    

    // Display the status under the splash screen
    console.log(dockerStatus);
    console.log(BLUE('LAN:'),GREEN(address))
    console.log(BLUE('WAN:'),GREEN(ipv4)) //  curl ip.me
    console.log(BLUE('Ubuntu:'),YELLOW(version),{name});
    console.log(BLUE('PostgreSQL'),YELLOW(psql),':',psqlStatus)
    console.log(BLUE('redis-server:'),redisStatus)
    console.log(BLUE('apache2:'),apache2Status)
    
    console.log(BLUE('app updates:'),appUpdates)
    console.log('')
    console.log(`\x1B]8;;${url}\x07${PURPLE(linkText)}\x1B]8;;\x07`);
}

let activeMenu = null;
/**
 * Clear any active prompts or actions before going back to the main menu
 */
function resetActiveMenu() {
    activeMenu = null;
}
const linkText = 'Want a professional to just fix it for you? Click here!';
const url = 'https://shop.hanssonit.se/product-category/support/';
// Klickbar länk i terminalen (fungerar i terminaler som stöder detta)


async function mainMenu() {

    
    
    

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
            const updateManager = new ncUPDATE();
            return updateManager.manageUpdate(mainMenu,exitProgram,VARS);

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
            return appsManager.manageApps(mainMenu);

        case 'Manage SMTP':
            const mailManager = new ncSMTP();
            return mailManager.manageSMTP(mainMenu);

        case 'Manage Docker':
            const dockerManager = new ncDOCKER();
            return dockerManager.manageDocker(mainMenu);

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
 * Make sure to reset the active menu before exiting or transitioning
 */
function exitProgram() {
    VARS.saveVariables('./variables.json');
    resetActiveMenu();  // Clear any active states before exiting
    console.log(chalk.green('Goodbye!'));
    process.exit(0);
}

(async () => {
    await welcome();
    await mainMenu();
})();