import { execSync } from 'child_process';
import { createSpinner } from 'nanospinner';
import inquirer from 'inquirer';
import fs from 'fs';
import { readFileSync, writeFileSync } from 'fs';
import { RED, GREEN, YELLOW } from './color.js';
import path from 'path';

/**
 * @class ncSMTP
 * @description A class to handle SMTP relay configuration for the Nextcloud server. It sets up an SMTP server used to send emails about failed cron jobs and other notifications.
 */
class ncSMTP {
    constructor() {
        this.smtpConfigFile = '/etc/msmtprc';
        this.variablesPath = path.join('/var/scripts', 'variables.json');
    }

    /**
     * @function isRoot
     * @description Checks if the script is running as root.
     * @throws Will throw an error if not running as root.
     */
    isRoot() {
        if (process.getuid() !== 0) {
            console.error(RED('This script must be run as root!'));
            process.exit(1);
        }
    }

    /**
     * @function checkVariablesFile
     * @description Ensures that the variables.json file exists.
     * @returns {object} The parsed variables.json content.
     */
    checkVariablesFile() {
        if (!fs.existsSync(this.variablesPath)) {
            console.error(RED('variables.json file not found.'));
            process.exit(1);
        }
        return JSON.parse(readFileSync(this.variablesPath, 'utf8'));
    }

    /**
     * @function updateVariables
     * @description Updates important SMTP-related variables in variables.json.
     * @param {string} key - The key in variables.json to update.
     * @param {string} value - The value to set for the specified key.
     */
    updateVariables(key, value) {
        let variables = this.checkVariablesFile();
        variables[key] = value;
        writeFileSync(this.variablesPath, JSON.stringify(variables, null, 4));
        console.log(`${GREEN(`Updated ${key} in variables.json`)}`);
    }

    /**
     * @function removeSMTPConfig
     * @description Removes existing SMTP configurations if msmtp is already installed.
     */
    removeSMTPConfig() {
        const spinner = createSpinner('Removing existing SMTP configuration...').start();
        try {
            execSync('sudo apt-get purge -y msmtp msmtp-mta mailutils');
            fs.unlinkSync('/etc/mail.rc');
            fs.unlinkSync(this.smtpConfigFile);
            execSync('rm -f /var/log/msmtp');
            fs.writeFileSync('/etc/aliases', '');
            spinner.success({ text: `${GREEN('SMTP configuration removed successfully.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to remove SMTP configuration.')}` });
            console.error(error);
        }
    }

    /**
     * @function installSMTP
     * @description Installs and configures SMTP relay for the Nextcloud server.
     */
    async installSMTP() {
        this.isRoot();
        const spinner = createSpinner('Installing SMTP...').start();

        try {
            execSync('sudo apt-get update && sudo apt-get install -y msmtp msmtp-mta mailutils');
            spinner.success({ text: `${GREEN('SMTP installation complete.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to install SMTP.')}` });
            console.error(error);
            return;
        }

        const { choice, mailServer, smtpPort, protocol, username, password, recipient } = await this.promptSMTPSettings();

        this.configureSMTP({
            mailServer,
            smtpPort,
            protocol,
            username,
            password,
            recipient
        });
        this.updateVariables('smtp_server', mailServer);
        this.updateVariables('smtp_port', smtpPort);
        this.updateVariables('smtp_protocol', protocol);
        this.updateVariables('smtp_username', username);
    }

    /**
     * @function promptSMTPSettings
     * @description Prompts the user for SMTP settings such as server, port, and credentials.
     * @returns {object} The SMTP settings collected from the user.
     */
    async promptSMTPSettings() {
        const choices = [
            { name: 'mail.de (German mail provider)', value: 'mail.de' },
            { name: 'SMTP2GO (https://www.smtp2go.com)', value: 'SMTP2GO' },
            { name: 'Manual setup', value: 'manual' }
        ];

        const { choice } = await inquirer.prompt([
            {
                type: 'list',
                name: 'choice',
                message: 'Choose the mail provider you want to use:',
                choices
            }
        ]);

        let mailServer = '', smtpPort = '', protocol = '', username = '', password = '', recipient = '';

        if (choice === 'manual') {
            const mailServerPrompt = await inquirer.prompt({
                type: 'input',
                name: 'mailServer',
                message: 'Enter the SMTP relay server (e.g., smtp.mail.com):'
            });
            mailServer = mailServerPrompt.mailServer;

            const protocolPrompt = await inquirer.prompt({
                type: 'list',
                name: 'protocol',
                message: 'Choose the encryption protocol for your SMTP relay:',
                choices: ['SSL', 'STARTTLS', 'NO-ENCRYPTION']
            });
            protocol = protocolPrompt.protocol;

            smtpPort = await this.promptPort(protocol);
        } else if (choice === 'SMTP2GO') {
            mailServer = 'mail-eu.smtp2go.com';
            protocol = 'SSL';
            smtpPort = '465';
            username = await this.promptUsername();
            password = await this.promptPassword();
        } else if (choice === 'mail.de') {
            mailServer = 'smtp.mail.de';
            protocol = 'SSL';
            smtpPort = '465';
            username = await this.promptUsername();
            password = await this.promptPassword();
        }

        recipient = await this.promptRecipient();

        return { choice, mailServer, smtpPort, protocol, username, password, recipient };
    }

    /**
     * @function promptPort
     * @description Prompts for the SMTP port based on the chosen encryption protocol.
     * @param {string} protocol - The encryption protocol chosen.
     * @returns {string} The SMTP port.
     */
    async promptPort(protocol) {
        const defaultPorts = { SSL: 465, STARTTLS: 587, 'NO-ENCRYPTION': 25 };
        const defaultPort = defaultPorts[protocol];

        const { portChoice } = await inquirer.prompt({
            type: 'list',
            name: 'portChoice',
            message: `Use default port (${defaultPort}) or enter another port?`,
            choices: [
                { name: `Use default port (${defaultPort})`, value: defaultPort },
                { name: 'Enter another port', value: 'custom' }
            ]
        });

        if (portChoice === 'custom') {
            const { customPort } = await inquirer.prompt({
                type: 'input',
                name: 'customPort',
                message: 'Enter the SMTP port:'
            });
            return customPort;
        }

        return portChoice;
    }

    /**
     * @function promptUsername
     * @description Prompts for the SMTP username.
     * @returns {string} The SMTP username.
     */
    async promptUsername() {
        const { username } = await inquirer.prompt({
            type: 'input',
            name: 'username',
            message: 'Enter the SMTP username (e.g., you@mail.com):'
        });
        return username;
    }

    /**
     * @function promptPassword
     * @description Prompts for the SMTP password.
     * @returns {string} The SMTP password.
     */
    async promptPassword() {
        const { password } = await inquirer.prompt({
            type: 'password',
            name: 'password',
            message: 'Enter the SMTP password:',
            mask: '*'
        });
        return password;
    }

    /**
     * @function promptRecipient
     * @description Prompts for the recipient email address.
     * @returns {string} The recipient email address.
     */
    async promptRecipient() {
        const { recipient } = await inquirer.prompt({
            type: 'input',
            name: 'recipient',
            message: 'Enter the recipient email address for notifications (e.g., recipient@mail.com):'
        });
        return recipient;
    }

    /**
     * @function configureSMTP
     * @description Configures the SMTP relay by writing the configuration to /etc/msmtprc.
     * @param {object} smtpSettings - The SMTP settings including server, port, username, password, and recipient.
     */
    configureSMTP({ mailServer, smtpPort, protocol, username, password, recipient }) {
        const spinner = createSpinner('Configuring SMTP...').start();

        try {
            const msmtpConfig = `
# Set default values for all following accounts.
defaults
auth            ${username ? 'on' : 'off'}
aliases         /etc/aliases
tls             ${protocol === 'NO-ENCRYPTION' ? 'off' : 'on'}
tls_starttls    ${protocol === 'STARTTLS' ? 'on' : 'off'}
tls_trust_file  /etc/ssl/certs/ca-certificates.crt

# Account to send emails
account         ${username}
host            ${mailServer}
port            ${smtpPort}
from            ${username}

account default : ${username}

### DO NOT REMOVE THIS LINE (used in Nextcloud Server)
# recipient=${recipient}
`;

            fs.writeFileSync(this.smtpConfigFile, msmtpConfig);
            execSync('chmod 600 /etc/msmtprc');
            spinner.success({ text: `${GREEN('SMTP configuration complete.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to configure SMTP.')}` });
            console.error(error);
        }
    }

    /**
     * @function sendTestEmail
     * @description Sends a test email to verify SMTP configuration.
     * @param {string} recipient - The recipient email address to send the test email.
     */
    async sendTestEmail(recipient) {
        const testMailContent = `
Congratulations!

Your SMTP Relay is working properly. This is a test email.

Best regards,
The NcVM Team
`;

        const spinner = createSpinner('Sending test email...').start();
        try {
            execSync(`echo "${testMailContent}" | mail -s "Test email from NcVM" ${recipient}`);
            spinner.success({ text: `${GREEN('Test email sent successfully! Check your inbox.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to send test email.')}` });
            console.error(error);
        }
    }
}

export default ncSMTP;

