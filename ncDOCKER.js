import { RED, BLUE, GREEN } from './color.js';
import { clearConsole, awaitContinue } from './ncUTILS.js';
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
     * Starts a specified Docker container after listing available containers.
     */
   async startContainer() {
    this.clearConsole();

    try {
        const output = execSync('docker ps -a --format "{{.Names}}"', { encoding: 'utf8' });
        const containers = output.trim().split('\n').filter(Boolean);
        
        if (containers.length === 0) {
            console.log(RED('No containers found.'));
            await this.awaitContinue();
            return this.manageDocker();
        }

        const { containerName } = await inquirer.prompt([
            {
                type: 'list',
                name: 'containerName',
                message: 'Select the container you want to start:',
                choices: containers
            }
        ]);

        const spinner = createSpinner(`Starting Docker container ${containerName}...`).start();
        execSync(`docker start ${containerName}`);
        spinner.success({ text: `${GREEN(`Docker container '${containerName}' started!`)}` });
    } catch (error) {
        console.error(RED(`Failed to start Docker container: ${error.message}`));
    }

    await this.awaitContinue();
    return this.manageDocker();
}

/**
 * Stops a specified Docker container after listing available containers.
 */
async stopContainer() {
    this.clearConsole();

    try {
        const output = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' });
        const containers = output.trim().split('\n').filter(Boolean);

        if (containers.length === 0) {
            console.log(RED('No running containers found.'));
            await this.awaitContinue();
            return this.manageDocker();
        }

        const { containerName } = await inquirer.prompt([
            {
                type: 'list',
                name: 'containerName',
                message: 'Select the container you want to stop:',
                choices: containers
            }
        ]);

        const spinner = createSpinner(`Stopping Docker container ${containerName}...`).start();
        execSync(`docker stop ${containerName}`);
        spinner.success({ text: `${GREEN(`Docker container '${containerName}' stopped!`)}` });
    } catch (error) {
        console.error(RED(`Failed to stop Docker container: ${error.message}`));
    }

    await this.awaitContinue();
    return this.manageDocker();
}

/**
 * Removes a specified Docker container after listing available containers.
 */
async removeContainer() {
    this.clearConsole();

    try {
        const output = execSync('docker ps -a --format "{{.Names}}"', { encoding: 'utf8' });
        const containers = output.trim().split('\n').filter(Boolean);

        if (containers.length === 0) {
            console.log(RED('No containers found.'));
            await this.awaitContinue();
            return this.manageDocker();
        }

        const { containerName } = await inquirer.prompt([
            {
                type: 'list',
                name: 'containerName',
                message: 'Select the container you want to remove:',
                choices: containers
            }
        ]);

        const spinner = createSpinner(`Removing Docker container ${containerName}...`).start();
        execSync(`docker rm ${containerName}`);
        spinner.success({ text: `${GREEN(`Docker container '${containerName}' removed!`)}` });
    } catch (error) {
        console.error(RED(`Failed to remove Docker container: ${error.message}`));
    }

    await this.awaitContinue();
    return this.manageDocker();
}

/**
 * Removes a specified Docker image after listing available images.
 */
async removeImage() {
    this.clearConsole();

    try {
        const output = execSync('docker images --format "{{.Repository}}:{{.Tag}}"', { encoding: 'utf8' });
        const images = output.trim().split('\n').filter(Boolean);

        if (images.length === 0) {
            console.log(RED('No images found.'));
            await this.awaitContinue();
            return this.manageDocker();
        }

        const { imageName } = await inquirer.prompt([
            {
                type: 'list',
                name: 'imageName',
                message: 'Select the image you want to remove:',
                choices: images
            }
        ]);

        const spinner = createSpinner(`Removing Docker image ${imageName}...`).start();
        
        try {
            // Attempt to remove the Docker image normally
            execSync(`docker rmi ${imageName}`);
            spinner.success({ text: `${GREEN(`Docker image '${imageName}' removed!`)}` });
        } catch (error) {
            // If an error occurs, check if it is related to the image being used
            if (error.message.includes('conflict: unable to remove repository reference')) {
                // Prompt the user to force-remove the image
                const { forceRemove } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'forceRemove',
                        message: `Image ${imageName} is being used by a container. Do you want to force-remove it?`,
                        default: false
                    }
                ]);

                if (forceRemove) {
                    // Force remove the image
                    execSync(`docker rmi --force ${imageName}`);
                    spinner.success({ text: `${GREEN(`Docker image '${imageName}' force-removed!`)}` });
                } else {
                    spinner.error({ text: `${RED(`Failed to remove Docker image '${imageName}'. Image is in use.`)}` });
                }
            } else {
                spinner.error({ text: `${RED(`Failed to remove Docker image '${imageName}'.`)}` });
                console.error(error.message);
            }
        }

    } catch (error) {
        console.error(RED(`Failed to remove Docker image: ${error.message}`));
    }

    await this.awaitContinue();
    return this.manageDocker();
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
        return this.manageDocker();
    }
}

export default ncDOCKER;
