import { RED,BLUE,GRAY,GRAYLI,GREEN,YELLOW,YELLOWLI,PURPLE } from './color.js';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process';
import chalk from 'chalk';


function clearConsole() {
    console.clear();  
    // process.stdout.write('\x1Bc')
}


/**
 * Class to manage Docker containers and images using Docker CLI.
 */
class ncDOCKER {
    constructor() {}

    /**
     * Check if Docker is installed.
     */
    checkDockerInstalled() {
        try {
            // Run the `docker` command to see if Docker is installed
            execSync('docker --version', { stdio: 'ignore' });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Install Docker on the system.
     */
    async installDocker() {
        const spinner = createSpinner('Installing Docker...').start();

        try {
            execSync(`sudo apt-get update && sudo apt-get install -y docker.io`, { stdio: 'inherit' });
            spinner.success({ text: `${GREEN('Docker installed successfully!')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to install Docker.')}` });
            console.error(error);
        }
    }


    /**
     * Displays the menu for Docker management.
     */
    async manageDocker(mainMenu) {

        let continueMenu = true;
        clearConsole();

        while (continueMenu === true) {

        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Docker Management:',
                choices: [
                    'List Containers',
                    'List Images',
                    'Start Container',
                    'Stop Container',
                    'Remove Container',
                    'Remove Image',
                    'View Networks',
                    'Go Back'
                ],
            }
        ]);

        switch (answers.action) {
            case 'List Containers':
                this.listContainers();
                break;
            case 'List Images':
                this.listImages();
                break;
            case 'Start Container':
                this.startContainer();
                break;
            case 'Stop Container':
                this.stopContainer();
            case 'Remove Container':
                this.removeContainer();
                break;
            case 'Remove Image':
                this.removeImage();
                break;
            case 'View Networks':
                this.viewNetworks();
                break;
            case 'Go Back':
                continueMenu = false;
                mainMenu();
                break;
        }
    }
    }
    /**
     * Lists all running and stopped Docker containers.
     */
    async listContainers() {
        clearConsole();
        const spinner = createSpinner('Fetching Docker containers...').start();

        try {
            const output = execSync('docker ps -a', { encoding: 'utf8' });
            spinner.success({ text: `${GREEN('Docker containers:')}` });
            console.log(output);
        } catch (error) {
            spinner.error({ text: `${RED('Failed to list Docker containers.')}` });
            console.error(error);
        }
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);

        await this.manageDocker();
    }

    /**
     * Lists all Docker images.
     */
    async listImages() {
        clearConsole();
        const spinner = createSpinner('Fetching Docker images...').start();

        try {
            const output = execSync('docker images', { encoding: 'utf8' });
            spinner.success({ text: `${GREEN('Docker images:')}` });
            console.log(output);
        } catch (error) {
            spinner.error({ text: `${RED('Failed to list Docker images.')}` });
            console.error(error);
        }

        await this.inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...'}])

        await this.manageDocker();
    }

    /**
     * Starts a specified Docker container.
     */
    async startContainer() {
        clearConsole();

        const { containerName } = await inquirer.prompt([
            {
                type: 'input',
                name: 'containerName',
                message: 'Enter the container name or ID you want to start:'
            }
        ]);

        const spinner = createSpinner(`Starting Docker container ${containerName}...`).start();

        try {
            execSync(`docker start ${containerName}`);
            spinner.success({ text: `${GREEN(`Docker container '${containerName}' started!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to start Docker container '${containerName}'.`)}` });
            console.error(error);
        }

        

        await this.manageDocker();
    }

    /**
     * Stops a specified Docker container.
     */
    async stopContainer() {
        clearConsole();
        const { containerName } = await inquirer.prompt([
            {
                type: 'input',
                name: 'containerName',
                message: 'Enter the container name or ID you want to stop:'
            }
        ]);

        const spinner = createSpinner(`Stopping Docker container ${containerName}...`).start();

        try {
            execSync(`docker stop ${containerName}`);
            spinner.success({ text: `${GREEN(`Docker container '${containerName}' stopped!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to stop Docker container '${containerName}'.`)}` });
            console.error(error);
        }

        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);

        await this.manageDocker();
    }

    /**
     * Removes a specified Docker container.
     */
    async removeContainer() {
        clearConsole();
        const { containerName } = await inquirer.prompt([
            {
                type: 'input',
                name: 'containerName',
                message: 'Enter the container name or ID you want to remove:'
            }
        ]);

        const spinner = createSpinner(`Removing Docker container ${containerName}...`).start();

        try {
            execSync(`docker rm ${containerName}`);
            spinner.success({ text: `${GREEN(`Docker container '${containerName}' removed!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to remove Docker container '${containerName}'.`)}` });
            console.error(error);
        }
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);

        await this.manageDocker();
    }

    /**
     * Removes a specified Docker image.
     */
    async removeImage() {
        clearConsole();
        const { imageName } = await inquirer.prompt([
            {
                type: 'input',
                name: 'imageName',
                message: 'Enter the image name or ID you want to remove:'
            }
        ]);

        const spinner = createSpinner(`Removing Docker image ${imageName}...`).start();

        try {
            execSync(`docker rmi ${imageName}`);
            spinner.success({ text: `${GREEN(`Docker image '${imageName}' removed!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to remove Docker image '${imageName}'.`)}` });
            console.error(error);
        }
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);

        await this.manageDocker();
    }

    /**
     * View Docker networks.
     */
    async viewNetworks() {
        clearConsole();
        const spinner = createSpinner('Fetching Docker networks...').start();

        try {
            const output = execSync('docker network ls', { encoding: 'utf8' });
            spinner.success({ text: `${GREEN('Docker networks:')}` });
            console.log(output);
        } catch (error) {
            spinner.error({ text: `${RED('Failed to fetch Docker networks.')}` });
            console.error(error);
        }
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);

        await this.manageDocker();
    }
}

export default ncDOCKER;
