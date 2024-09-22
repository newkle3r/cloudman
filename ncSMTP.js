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
     * Displays the menu for SMTP management tasks.
     */
   async manageSMTP(mainMenu) {
    let continueMenu = true;
    
    while (continueMenu) {
        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'SMTP Management:',
                choices: [
                    'Install SMTP (msmtp)',
                    'Install Postfix',
                    'Install Dovecot',
                    'Set up SSL Certificates',
                    'Integrate with Nextcloud',
                    'Send Test Email',
                    'Remove SMTP Configuration',
                    'Go Back'
                ]
            }
        ]);

        switch (answers.action) {
            case 'Install SMTP (msmtp)':
                await this.installSMTP();
                break;
            case 'Install Postfix':
                this.installPostfix();
                break;
            case 'Install Dovecot':
                this.installDovecot();
                break;
            case 'Set up SSL Certificates':
                this.setupSSL();
                break;
            case 'Integrate with Nextcloud':
                this.integrateWithNextcloud();
                break;
            case 'Send Test Email':
                const { recipient } = await inquirer.prompt({
                    type: 'input',
                    name: 'recipient',
                    message: 'Enter recipient email for the test email:'
                });
                await this.sendTestEmail(recipient);
                break;
            case 'Remove SMTP Configuration':
                this.removeSMTPConfig();
                break;
            case 'Go Back':
                continueMenu = false;
                mainMenu(); // Return to the main menu
                break;
        }
    }
}


checkVariablesFile() {
    if (!fs.existsSync(this.variablesPath)) {
        console.error(RED('variables.json file not found.'));
        process.exit(1);
    }
    return JSON.parse(readFileSync(this.variablesPath, 'utf8'));
}

updateVariables(key, value) {
    let variables = this.checkVariablesFile();
    variables[key] = value;
    writeFileSync(this.variablesPath, JSON.stringify(variables, null, 4));
    console.log(`${GREEN(`Updated ${key} in variables.json`)}`);
}

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

async installSMTP() {
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


/**
 * @function installPostfix
 * @description Installs and configures Postfix as the Mail Transfer Agent (MTA).
 */
installPostfix() {
    const spinner = createSpinner('Installing and configuring Postfix...').start();

    try {
        execSync('sudo apt-get update && sudo apt-get install -y postfix');
        // Configure Postfix main.cf
        const postfixConfig = `
myhostname = mail.mydomain.com
myorigin = /etc/mailname
mydestination = mail.mydomain.com, localhost, localhost.localdomain
relayhost =
mynetworks = 127.0.0.0/8
mailbox_size_limit = 0
recipient_delimiter = +
inet_interfaces = all

# SSL Settings
smtpd_tls_cert_file=/etc/ssl/certs/mailcert.pem
smtpd_tls_key_file=/etc/ssl/private/mail.key
smtpd_use_tls=yes
smtpd_tls_security_level=may

# SASL authentication
smtpd_sasl_auth_enable = yes
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth
        `;
        fs.writeFileSync('/etc/postfix/main.cf', postfixConfig);

        // Restart Postfix to apply changes
        execSync('sudo systemctl restart postfix');
        spinner.success({ text: `${GREEN('Postfix installed and configured successfully.')}` });
    } catch (error) {
        spinner.error({ text: `${RED('Failed to install and configure Postfix.')}` });
        console.error(error);
    }
}

/**
 * @function installDovecot
 * @description Installs and configures Dovecot as the IMAP server.
 */
installDovecot() {
    const spinner = createSpinner('Installing and configuring Dovecot...').start();

    try {
        execSync('sudo apt-get install -y dovecot-core dovecot-imapd');

        // Configure Dovecot dovecot.conf
        const dovecotConfig = `
disable_plaintext_auth = no
mail_privileged_group = mail
mail_location = mbox:~/mail:INBOX=/var/mail/%u
protocols = imap

service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
}

ssl=required
ssl_cert = </etc/ssl/certs/mailcert.pem
ssl_key = </etc/ssl/private/mail.key
        `;
        fs.writeFileSync('/etc/dovecot/dovecot.conf', dovecotConfig);

        // Restart Dovecot to apply changes
        execSync('sudo systemctl restart dovecot');
        spinner.success({ text: `${GREEN('Dovecot installed and configured successfully.')}` });
    } catch (error) {
        spinner.error({ text: `${RED('Failed to install and configure Dovecot.')}` });
        console.error(error);
    }
}
/**
 * @function setupSSL
 * @description Generates a self-signed SSL certificate for mail encryption.
 */
setupSSL() {
    const spinner = createSpinner('Setting up SSL certificates...').start();

    try {
        // Generate self-signed certificate
        execSync('sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/private/mail.key -out /etc/ssl/certs/mailcert.pem -subj "/C=US/ST=State/L=City/O=Organization/OU=IT/CN=mail.mydomain.com"');
        spinner.success({ text: `${GREEN('SSL certificates created successfully.')}` });
    } catch (error) {
        spinner.error({ text: `${RED('Failed to create SSL certificates.')}` });
        console.error(error);
    }
}
/**
 * @function integrateWithNextcloud
 * @description Configures Nextcloud to use the newly set up SMTP server for notifications.
 */
integrateWithNextcloud() {
    const spinner = createSpinner('Integrating SMTP with Nextcloud...').start();

    try {
        const variables = this.checkVariablesFile();
        const smtpSettings = `
'mail_smtpmode' => 'smtp',
'mail_smtpauthtype' => 'LOGIN',
'mail_smtpname' => '${variables.smtp_username}',
'mail_smtppassword' => '${variables.smtp_password}',
'mail_smtphost' => '${variables.smtp_server}',
'mail_smtpport' => '${variables.smtp_port}',
'mail_from_address' => 'admin',
'mail_domain' => 'mydomain.com',
'mail_smtpsecure' => '${variables.smtp_protocol === 'SSL' ? 'ssl' : 'tls'}',
        `;
        
        const nextcloudConfigPath = '/var/www/nextcloud/config/config.php';
        const config = fs.readFileSync(nextcloudConfigPath, 'utf8');
        const updatedConfig = config.replace(/(.*'mail_smtpmode'.*)/, smtpSettings);
        fs.writeFileSync(nextcloudConfigPath, updatedConfig);
        
        spinner.success({ text: `${GREEN('Nextcloud SMTP settings updated successfully.')}` });
    } catch (error) {
        spinner.error({ text: `${RED('Failed to update Nextcloud SMTP settings.')}` });
        console.error(error);
    }
}
}

export default ncSMTP;

