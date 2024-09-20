#!/usr/bin/env node

import chalk from 'chalk';
import inquirer from 'inquirer';
import gradient from 'gradient-string';
import chalkAnimation from 'chalk-animation';
import figlet from 'figlet';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process';  // For executing shell commands

import ncVars from './ncVARS.js';
import ncAPPS from './ncAPPS.js';
import ncFQDN from './ncFQDN.js';
import ncPHP from './ncPHP.js';
import ncSQL from './ncSQL.js';
import nextcloud from './nextcloud.js';
import ncDocker from './ncDocker.js';
import NextcloudManager from './nextcloud.js';
import ncLDAP from './ncLDAP.js';
import ncREDIS from './ncREDIS.js';
import ncDocker from './ncDocker.js';


const nextcloudManager = new NextcloudManager();
// nextcloudManager.installNextcloud();





console.log(chalk.redBright('Nextcloud Manager - Cloudman'));

const RED = chalk.redBright;
const BLUE = chalk.blue;
const GREEN = chalk.green;
const YELLOW = chalk.yellow;
const GRAYLI = chalk.bgGrey;
const GRAY = chalk.gray;
const YELLOWLI = chalk.bgYellowBright;
const PURPLE = chalk.magenta;

const VARS = new ncVars();
const SQL = new ncSQL();
const DOCKER = new ncDocker();

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
                'Install Nextcloud',
                'Update Nextcloud',
                'Repair Nextcloud',
                'Manage PostgreSQL',
                'Manage PHP',
                'Manage DNS/FQDN',
                'Manage LDAP',
                'Manage Nextcloud Apps',
                'Manage Docker',
                'Manage Redis',
                'Exit'
            ],
        }
    ]);

    switch (answers.action) {
        case 'Install Nextcloud':
            return installNextcloud();
        case 'Update Nextcloud':
            return updateNextcloud();
        case 'Repair Nextcloud':
            return repairNextcloud();
        case 'Manage PostgreSQL':
            const sqlManager = new ncSQL();         // Create an instance of the ncSQL class
            return sqlManager.managePostgreSQL();   // Call the managePostgreSQL method
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
            const appsManager = new ncAPPS();  // Create an instance of ncAPPS class
            return appsManager.manageApps();   // Call the manageApps method

        case 'Manage Docker':
            const dockerManager = new ncDocker();
            return dockerManager.manageDocker();
     
        case 'Manage Redis':
            const redisManager = new ncREDIS();
            return redisManager.manageRedis();

            
        
        case 'Exit':
            vars.saveVariables();
        
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
