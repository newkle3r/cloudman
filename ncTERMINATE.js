import { RED,GREEN,YELLOW } from './color.js';
import { execSync } from 'child_process';
import inquirer from 'inquirer';
import chalk from 'chalk';

class ncTERMINATOR {
    // Method to check for running package management processes
    checkRunningProcesses() {
        try {
            const aptStatus = execSync('pgrep apt').toString().trim();
            const dpkgStatus = execSync('pgrep dpkg').toString().trim();
            const unattendedUpgradesStatus = execSync('pgrep unattended-upgrades').toString().trim();
            const upgradeStatus = execSync('pgrep upgrade').toString().trim();

            return aptStatus || dpkgStatus || unattendedUpgradesStatus || upgradeStatus;
        } catch (error) {
            // If no processes are found, `pgrep` will throw an error, meaning no relevant processes are running
            return false;
        }
    }

    // Method to terminate the Cloudman CLI
    killCloudman() {
        console.log(chalk.blue('Shutting down Cloudman...'));
        process.exit(0); // Exit the Node.js process successfully
    }

    // Method to prompt user if processes are running
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
            this.killCloudman(); // Shut down Cloudman after confirmation
        } else {
            console.log(chalk.yellow('Shutdown canceled.'));
        }
    }

    // Method to check processes and decide shutdown behavior
    async terminate() {
        console.log(chalk.green('Checking for running processes...'));

        const processesRunning = this.checkRunningProcesses();

        if (processesRunning) {
            console.log(chalk.yellow('Critical processes are currently running.'));
            await this.promptShutdown(); // Prompt user if critical processes are running
        } else {
            console.log(chalk.green('No critical processes are running.'));
            this.killCloudman(); // No processes are running, shut down Cloudman
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
