import chalk from 'chalk';
import inquirer from 'inquirer';
import gradient from 'gradient-string';
import chalkAnimation from 'chalk-animation';
import figlet from 'figlet';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process';  // For executing shell commands

const RED = chalk.redBright;
const BLUE = chalk.blue;
const GREEN = chalk.green;
const YELLOW = chalk.yellow;
const GRAYLI = chalk.bgGrey;
const GRAY = chalk.gray;
const YELLOWLI = chalk.bgYellowBright;
const PURPLE = chalk.magenta;


/**
 * Displays a menu for PHP management tasks such as identifying the PHP version, downgrading, upgrading, repairing Nextcloud PHP, and managing PHP logs.
 * Prompts the user to select an action and invokes the corresponding function based on the selection.
 * 
 * @returns {Promise<void>} Promises to handle user input and manage PHP based on the action selected.
 */

async function managePHP() {
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
                'Tail PHP logs',
                'Print PHP logs',
                'Go Back'
            ],
        }
    ]);

    switch (answers.action) {
        case 'Identify Version':
            return identifyPHP();
        case 'Downgrade to php7.4':
            return downgradePHP74();
        case 'Repair Nextcloud PHP':
            return repairPHP();
        case 'Tail PHP logs':
            return tailPHPlogs();
        case 'Print PHP logs':
            return printPHPlogs();
        case 'Go Back':
            return mainMenu();
    }
}