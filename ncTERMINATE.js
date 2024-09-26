import { RED,GREEN,YELLOW } from './color.js';
import { clearConsole,welcome } from './utils.js';
import { execSync } from 'child_process';
import inquirer from 'inquirer';
import chalk from 'chalk';

class ncTERMINATOR {
    checkRunningProcesses() {
        try {
            const aptStatus = execSync('pgrep apt').toString().trim();
            const dpkgStatus = execSync('pgrep dpkg').toString().trim();
            const unattendedUpgradesStatus = execSync('pgrep unattended-upgrades').toString().trim();
            const upgradeStatus = execSync('pgrep upgrade').toString().trim();

            return aptStatus || dpkgStatus || unattendedUpgradesStatus || upgradeStatus;
        } catch (error) {
            return false;
        }
    }


    killCloudman() {
        console.log(chalk.blue('Shutting down Cloudman...'));
        process.exit(0); 
    }


    async promptShutdown() {
        const { shutdown } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'shutdown',
                message: 'There are processes running (updates, installs). Do you want to force shutdown Cloudman?',
                default: false,
            },
        ]);

        if (shutdown) {
            this.killCloudman(); 
        } else {
            console.log(chalk.yellow('Shutdown canceled.'));
        }
    }

    async terminate() {
        console.log(chalk.green('Checking for running processes...'));

        const processesRunning = this.checkRunningProcesses();

        if (processesRunning) {
            console.log(chalk.yellow('Critical processes are currently running.'));
            await this.promptShutdown(); 
        } else {
            console.log(chalk.green('No critical processes are running.'));
            this.killCloudman(); 
        }
    }
}
export default ncTERMINATOR;
/*
// Main entry point to trigger termination check and shutdown
(async () => {
    const terminator = new ncTERMINATOR();
    await terminator.terminate();
})();
*/
