import { RED, BLUE, GREEN } from './color.js';
import { clearConsole, awaitContinue } from './utils.js';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process';

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
     * Displays the menu for Docker management.
     */
    async manageDocker() {
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
                    await this.listContainers();
                    break;
                case 'List Images':
                    await this.listImages();
                    break;
                case 'Start Container':
                    await this.startContainer();
                    break;
                case 'Stop Container':
                    await this.stopContainer();
                    break;
                case 'Remove Container':
                    await this.removeContainer();
                    break;
                case 'Remove Image':
                    await this.removeImage();
                    break;
                case 'View Networks':
                    await this.viewNetworks();
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
            console.error(error.message);
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
            console.error(error.message);
        }

        await this.awaitContinue();
        await this.manageDocker();
    }

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

        await this.awaitContinue();
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

        await this.awaitContinue();
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

        await this.awaitContinue();
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

        await this.awaitContinue();
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
            console.error(error.message);
        }

        await this.awaitContinue();
        await this.manageDocker();
    }
}

export default ncDOCKER;
