import { execSync } from 'child_process';
import inquirer from 'inquirer';
import chalk from 'chalk';

// Function to check for running package management processes
function checkRunningProcesses() {
    try {
        const aptStatus = execSync('pgrep apt').toString().trim();
        const dpkgStatus = execSync('pgrep dpkg').toString().trim();
        const unattendedUpgradesStatus = execSync('pgrep unattended-upgrades').toString().trim();
        const upgradeStatus = execSync('pgrep upgrade').toString().trim();

        return aptStatus || dpkgStatus || unattendedUpgradesStatus || upgradeStatus;
    } catch (error) {
        // If no processes are found, `pgrep` will throw an error, which means no relevant processes are running.
        return false;
    }
}

// Function to shutdown the system
function shutdownSystem() {
    try {
        console.log(chalk.blue('Shutting down the system...'));
        execSync('sudo shutdown now');
    } catch (error) {
        console.error(chalk.red('Failed to shut down the system:'), error);
    }
}

// Function to prompt user if processes are running
async function promptShutdown() {
    const { shutdown } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'shutdown',
            message: 'There are processes running (updates, installs). Do you want to force a shutdown?',
            default: false,
        },
    ]);

    if (shutdown) {
        shutdownSystem();
    } else {
        console.log(chalk.yellow('Shutdown canceled.'));
    }
}

// ncTERMINATE function
async function ncTERMINATE() {
    console.log(chalk.green('Checking for running processes...'));

    const processesRunning = checkRunningProcesses();

    if (processesRunning) {
        console.log(chalk.yellow('Critical processes are currently running.'));
        await promptShutdown();
    } else {
        console.log(chalk.green('No critical processes are running.'));
        shutdownSystem();
    }
}

// Exporting the function
export { ncTERMINATE }

// Main entry point to trigger termination check and shutdown
(async () => {
    await ncTERMINATE();
})();
