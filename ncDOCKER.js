import { RED,BLUE,GRAY,GRAYLI,GREEN,YELLOW,YELLOWLI,PURPLE } from './color.js';
import { clearConsole,welcome,awaitContinue } from './utils.js';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process';
import chalk from 'chalk';

// Needs new splash

/**
 * Class to manage Docker containers and images using Docker CLI.
 */
class ncDOCKER {
    constructor(mainMenu) {
        this.mainMenu = mainMenu;
        this.clearConsole = clearConsole;
        this.awaitContinue = awaitContinue;
    
    }

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
        await this.awaitContinue();
        await this.manageDocker();

    }


    /**
     * Displays the menu for Docker management.
     */
    async manageDocker(mainMenu) {

        let continueMenu = true;
        this.clearConsole();
       

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
                break;
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
                return this.mainMenu();
                
        }
    }
    }

    /**
     * Lists all running and stopped Docker containers.
     */
    async listContainers() {
        this.clearConsole();
        const spinner = createSpinner('Fetching Docker containers...').start();
    
        try {
            const output = execSync('docker ps -a', { encoding: 'utf8' });
            spinner.success({ text: `${GREEN('Docker containers:')}` });
            console.log(output);
        } catch (error) {
            spinner.error({ text: `${RED('Failed to list Docker containers.')}` });
            console.error(error);
        }
    
        await this.awaitContinue();
        await this.manageDocker();
    }
    

    /**
     * Lists all Docker images.
     */
    async listImages() {
        this.clearConsole();
        const spinner = createSpinner('Fetching Docker images...').start();

        try {
            const output = execSync('docker images', { encoding: 'utf8' });
            spinner.success({ text: `${GREEN('Docker images:')}` });
            console.log(output);
        } catch (error) {
            spinner.error({ text: `${RED('Failed to list Docker images.')}` });
            console.error(error);
        }

        await this.awaitContinue();
        await this.manageDocker();
    }

    /**
     * Starts a specified Docker container.
     */
    /**
 * Starts a specified Docker container.
 */
    async startContainer() {
        this.clearConsole();
    
        const { containerName } = await inquirer.prompt([
            {
                type: 'input',
                name: 'containerName',
                message: 'Enter the container name or ID you want to start:',
                validate: input => input ? true : 'You must provide a valid container name or ID.'
            }
        ]);
    
        const spinner = createSpinner(`Starting Docker container ${containerName}...`).start();
    
        try {
            execSync(`docker start ${containerName}`);
            spinner.success({ text: `${GREEN(`Docker container '${containerName}' started!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to start Docker container '${containerName}'.`)}` });
            console.error(error.message);
        }
    
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to return to Docker management...' }]);
        await this.manageDocker();
    }
    
    /**
     * Stops a specified Docker container.
     */
    async stopContainer() {
        this.clearConsole();
        const { containerName } = await inquirer.prompt([
            {
                type: 'input',
                name: 'containerName',
                message: 'Enter the container name or ID you want to stop:',
                validate: input => input ? true : 'You must provide a valid container name or ID.'
            }
        ]);
    
        const spinner = createSpinner(`Stopping Docker container ${containerName}...`).start();
    
        try {
            execSync(`docker stop ${containerName}`);
            spinner.success({ text: `${GREEN(`Docker container '${containerName}' stopped!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to stop Docker container '${containerName}'.`)}` });
            console.error(error.message);
        }
    
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to return to Docker management...' }]);
        await this.manageDocker();
    }
    
    /**
     * Removes a specified Docker container.
     */
    async removeContainer() {
        this.clearConsole();
        const { containerName } = await inquirer.prompt([
            {
                type: 'input',
                name: 'containerName',
                message: 'Enter the container name or ID you want to remove:',
                validate: input => input ? true : 'You must provide a valid container name or ID.'
            }
        ]);
    
        const spinner = createSpinner(`Removing Docker container ${containerName}...`).start();
    
        try {
            execSync(`docker rm ${containerName}`);
            spinner.success({ text: `${GREEN(`Docker container '${containerName}' removed!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to remove Docker container '${containerName}'.`)}` });
            console.error(error.message);
        }
    
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to return to Docker management...' }]);
        await this.manageDocker();
    }
    
    /**
     * Removes a specified Docker image.
     */
    async removeImage() {
        this.clearConsole();
        const { imageName } = await inquirer.prompt([
            {
                type: 'input',
                name: 'imageName',
                message: 'Enter the image name or ID you want to remove:',
                validate: input => input ? true : 'You must provide a valid image name or ID.'
            }
        ]);
    
        const spinner = createSpinner(`Removing Docker image ${imageName}...`).start();
    
        try {
            execSync(`docker rmi ${imageName}`);
            spinner.success({ text: `${GREEN(`Docker image '${imageName}' removed!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to remove Docker image '${imageName}'.`)}` });
            console.error(error.message);
        }
    
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to return to Docker management...' }]);
        await this.manageDocker();
    }
    

    /**
     * View Docker networks.
     */
    async viewNetworks() {
        this.clearConsole();
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
