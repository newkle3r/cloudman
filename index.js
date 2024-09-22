#!/usr/bin/env node
import { RED,BLUE,GRAY,GRAYLI,GREEN,YELLOW,YELLOWLI,PURPLE } from './color.js';
import ncVars from './ncVARS.js';
import ncAPPS from './ncAPPS.js';
import ncFQDN from './ncFQDN.js';
import ncPHP from './ncPHP.js';
import ncSQL from './ncSQL.js';
import ncDOCKER from './ncDOCKER.js';
import ncUPDATE from './ncUPDATE.js';
import ncBAK from './ncBAK.js';
import ncLDAP from './ncLDAP.js';
import ncREDIS from './ncREDIS.js';
import ncTERMINATOR from './ncTERMINATE.js';
import noVMNC from './nextcloud.js';




import fs from 'fs';
import chalk, { colorNames } from 'chalk';
import chalkAnimation from 'chalk-animation';
import gradient from 'gradient-string';
import figlet from 'figlet';
import { execSync } from 'child_process';
import inquirer from 'inquirer';
import ncVARS from './ncVARS.js';


const varsclass = new ncVARS();

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

async function welcome() {


    // Load variables from variables.json
    const vars = loadVariables();
    const distro = varsclass.DISTRO;
    const address = varsclass.ADDRESS;
    const ipv4 = varsclass.WANIP4;
    const psql = varsclass.PSQLVER;
    const redis = execSync("systemctl status redis-server | grep Active | awk '{print $2}'")
    const apache2 = execSync("systemctl status apache2 | grep Active | awk '{print $2}'")
    const postgresql = execSync("systemctl status postgresql | grep Active | awk '{print $2}'")
    const phpVersion = vars.PHP || 'Unknown PHP';
    const domain = vars.TLSDOMAIN || 'No Domain';
    const ports = vars.NONO_PORTS || [80, 443];
    const redisSock = vars.REDIS_SOCK || 'No Redis';
    const dockerStatus = await checkComponent('docker --version');
    const wan = vars.WANIP4 || 'disconnected';

    // Create status indicators for each component
    const phpStatus = await checkComponent(`php -v | grep ${phpVersion}`) ? GREEN(`[${phpVersion}]`) : RED(`[${phpVersion}]`);
    const domainStatus = domain !== 'No Domain' ? GREEN(`[${domain}]`) : RED(`[${domain}]`);
    const portsStatus = ports.length > 0 ? GREEN(`[${ports.join(', ')}]`) : RED(`[No Ports]`);
    const redisStatus = await checkComponent(`test -S ${redisSock}`) ? GREEN(`[redis]`) : RED(`[No Redis]`);
    const dockerStatusText = dockerStatus ? GREEN(`[docker]`) : RED(`[No Docker]`);
    const wanStatus = GREEN(`[${wan}]`);
    const redisServer = GREEN(`redis-server: ${redis}`)
    const apache2Status = GREEN(`apache2: ${apache2}`)
    const psqlStatus = GREEN(`postgreSQL v.${psql}: ${postgresql}`)
    const PHP = GREEN(`PHP${phpVersion}`)

    const rainbowTitle = chalkAnimation.rainbow(
        'Nextcloud instance manager by T&M Hansson IT \n'
    );

    await sleep();
    rainbowTitle.stop();

    console.log(
        gradient.pastel.multiline(
            figlet.textSync('Cloudman', { horizontalLayout: 'full' })
        )
    );

    // Display the status under the splash screen
    
    console.log(`${phpStatus} ${domainStatus}   `);
    console.log(`${wanStatus} ${dockerStatusText}`);
    console.log(`${redisServer}`);
    console.log(`${psqlStatus}`);
    console.log(`${PHP}`);
    console.log(`${apache2Status}`);
    console.log('');
    console.log('');
    console.log(`${PURPLE('Welcome to Nextcloud Manager!')}`);
    console.log(`${YELLOW('by T&M Hansson IT')}`)
    console.log('')
}


let activeMenu = null;
/**
 * Clear any active prompts or actions before going back to the main menu
 */
function resetActiveMenu() {
    activeMenu = null;
}

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