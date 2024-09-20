#!/usr/bin/env node
import { RED,BLUE,GRAY,GRAYLI,GREEN,YELLOW,YELLOWLI,PURPLE } from './color.js';
import ncVars from './ncVARS.js';
import ncAPPS from './ncAPPS.js';
import ncFQDN from './ncFQDN.js';
import ncPHP from './ncPHP.js';
import ncSQL from './ncSQL.js';
import ncDocker from './ncDocker.js';
import ncUPDATE from './ncUPDATE.js';
import ncBAK from './ncBAK.js';
import ncLDAP from './ncLDAP.js';
import ncREDIS from './ncREDIS.js';
import { ncTERMINATE } from './ncTERMINATE.js';


import chalk from 'chalk';
import inquirer from 'inquirer';
import gradient from 'gradient-string';
import chalkAnimation from 'chalk-animation';
import figlet from 'figlet';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process';
import ncTERMINATE from './ncTERMINATE.js';






// console.log(chalk.redBright('Nextcloud Manager - Cloudman'));


const VARS = new ncVars();



VARS.loadVariables('variables.json');

const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

async function welcome() {
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

    
    
    console.log(`${GREEN('Welcome to Nextcloud Manager!')}`);
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
                'Manage Docker',
                'Manage Redis',
                'Backup',
                'Exit'
            ],
        }
    ]);

    switch (answers.action) {

        case 'Update Nextcloud':
            const updateManager = new ncUPDATE();
            return updateManager.mainMenu();
        case 'Repair Nextcloud':
            
            return repairNextcloud();
        case 'Manage PostgreSQL':
            const sqlManager = new ncSQL();         
            return sqlManager.managePostgreSQL();  
        case 'Manage PHP':
            const phpManager = new ncPHP(); 
            return phpManager.managePHP();

        case 'Manage DNS/FQDN':
            const dnsManager = new ncFQDN();
            return dnsManager.manageFQDN();

        case 'Manage LDAP':
            const ldapManager = new ncLDAP();
            return ldapManager.manageLDAP();
            
        case 'Manage Nextcloud Apps':
            const appsManager = new ncAPPS();  
            return appsManager.manageApps();   

        case 'Manage Docker':
            const dockerManager = new ncDocker();
            return dockerManager.manageDocker();
     
        case 'Manage Redis':
            const redisManager = new ncREDIS();
            return redisManager.manageRedis();
        
        case 'Backup':
            const backupManager =new ncBAK();
            return backupManager.runBackups();

            
        
        case 'Exit':
            VARS.saveVariables();
            ncTERMINATE();

        
            return exitProgram();
    }
}












async function exitProgram() {
    console.log(GREEN('Goodbye!'));
    process.exit(0);
}

(async () => {
    await welcome();
    await mainMenu();
})();
