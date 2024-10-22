import fs from 'fs';
import { execSync } from 'child_process';
import { RED, GREEN, BLUE, YELLOW, PURPLE } from './color.js';
import ncUTILS from './ncUTILS.js';
import ncRedisServer from './ncRedisServer.js';
import { throws } from 'assert';
import ncBAK from './ncBAK.js';
import ncREDIS from './ncREDIS.js';
import { Certificate } from 'crypto';

/**
 * Class to manage Nextcloud configuration variables.
 * Provides functionality to load, save, and update system variables in variables.json.
 */
class ncVARS {
    
    constructor(filePath = './variables.json') {
        this.util = new ncUTILS();
        this.run = this.util.runCommand;
        this.gen = this.util.genPasswd;
        this.redisServ = new ncRedisServer();
        
        // Load variables
        this.filePath = filePath;
        this.variables = this.loadVariables() || {}; // Fallback to an empty object if loading fails

        // Fetch PHP version from Redis server
        this.phpversion = this.redisServ.getPHPVersion();
        
        // Initialize system statuses
        this.psqlStatus = this.getServiceStatus('postgresql');
        this.redisStatus = this.getServiceStatus('redis-server');
        this.apache2Status = this.getServiceStatus('apache2');
        this.dockerStatus = this.getDockerStatus();
        this.phpfpmStatus = this.getServiceStatus(`php${this.phpversion}-fpm.service`);
        
    

        

        // Load variables from file during initialization
        //this.loadVariables();

        // Fetch statuses
        this.psqlStatus = this.getServiceStatus('postgresql');
        this.redisStatus = this.getServiceStatus('redis-server');
        this.apache2Status = this.getServiceStatus('apache2');
        this.dockerStatus = this.getDockerStatus();
        this.phpfpmStatus = this.getServiceStatus(`php${this.phpversion}-fpm.service`);
        this.nextcloudState = this.getNCstate();
        this.nextcloudVersion = this.NEXTCLOUD_VERSION;
        

        // Default directories and paths
        this.SCRIPTS = '/var/scripts';
        this.HTML = '/var/www';
        this.NCPATH = `${this.HTML}/nextcloud`;
        this.POOLNAME = 'ncdata';
        this.NCDATA = `/mnt/${this.POOLNAME}`;
        this.VMLOGS = '/var/log/nextcloud';
        this.SNAPDIR = '/var/snap/spreedme';
        this.GPGDIR = '/tmp/gpg';
        this.SHA256_DIR = '/tmp/sha256';
        this.BACKUP = '/mnt/NCBACKUP';
        this.NC_APPS_PATH = `${this.NCPATH}/apps`;
        this.VMLOGS = '/var/log/nextcloud';
        this.PSQLVER = this.getPostgresVersion();

        this.NEXTCLOUD_VERSION = null;
        this.NEXTCLOUD_STATUS =  null;

        

        // Ubuntu OS information
        this.DISTRO = this.getCommandOutput('lsb_release -sr');
        this.CODENAME = this.getCommandOutput('lsb_release -sc');
        this.KEYBOARD_LAYOUT = this.getCommandOutput("localectl status | grep 'Layout' | awk '{print $3}'");

        // System vendor and networking
        this.SYSVENDOR = this.getCommandOutput('cat /sys/devices/virtual/dmi/id/sys_vendor');
        this.IFACE = this.getCommandOutput("ip r | grep 'default via' | awk '{print $5}'");
        this.IFACE2 = this.getCommandOutput("ip -o link show | awk '{print $2,$9}' | grep 'UP' | cut -d ':' -f 1");
        this.REPO = this.getCommandOutput("grep '^deb ' /etc/apt/sources.list | grep http | awk '{print $2}' | head -1");
        this.ADDRESS = this.getCommandOutput('hostname -I | cut -d " " -f 1');
        this.WANIP4 = this.getCommandOutput('curl -s -k -m 5 -4 https://api64.ipify.org');
        this.INTERFACES = '/etc/netplan/nextcloud.yaml';
        this.GATEWAY = this.getCommandOutput("ip route | grep default | awk '{print $3}'");

        // Domain and TLS configuration
        this.DEDYNDOMAIN = this.getCommandOutput("hostname -f");
        this.TLSDOMAIN = this.getCommandOutput("hostname -f");
        this.PHPVER = this.phpversion;
        // this.CERTFILES = this.getCommandOutput("sudo certbot certificates | grep -i 'Certificate Path' | awk '{print $3}'");
        this.DHPARAMS_TLS = '/etc/ssl/certs/dhparam.pem';
        this.SETENVPROXY = 'proxy-sendcl';
        this.DEDYNPORT = '443';
        this.PHP_FPM_DIR=`/etc/php/${this.PHPVER}/fpm`;
        this.PHP_INI=`${this.PHP_FPM_DIR}/php.ini`;
        this.PHP_POOL_DIR=`${this.PHP_FPM_DIR}/pool.d`;
        this.PHP_MODS_DIR=`/etc/php/${this.PHPVER}/mods-available`;
        this.opcache_interned_strings_buffer_value=`24`;
        // Letsencrypt
        this.SITES_AVAILABLE="/etc/apache2/sites-available";
        this.LETSENCRYPTPATH="/etc/letsencrypt";
        this.LETSENCRYPTFILE = `${this.LETSENCRYPTPATH}/cert.pem`;
        this.CERTFILES=`${this.LETSENCRYPTPATH}/live`;
        this.DHPARAMS_TLS=`${this.CERTFILES}/${this.TLSDOMAIN}/dhparam.pem`;
        this.DHPARAMS_SUB=`${this.CERTFILES}/${this.SUBDOMAIN}/dhparam.pem`;
        this.TLS_CONF="nextcloud_tls_domain_self_signed.conf";
        this.HTTP_CONF="nextcloud_http_domain_self_signed.conf";

        // Github Repo Nextcloud VM
        this.GITHUB_REPO="https://raw.githubusercontent.com/nextcloud/vm/main";
        this.STATIC=`${this.GITHUB_REPO}/static`;
        this.LETS_ENC=`${this.GITHUB_REPO}/lets-encrypt`;
        this.APP=`${this.GITHUB_REPO}/apps`;
        this.OLD=`${this.GITHUB_REPO}/old`;
        this.ADDONS=`${this.GITHUB_REPO}/addons`;
        this.DESEC=`${this.GITHUB_REPO}/addons/deSEC`;
        this.MENU=`${this.GITHUB_REPO}/menu`;
        this.DISK=`${this.GITHUB_REPO}/disk`;
        this.NETWORK=`${this.GITHUB_REPO}/network`;
        this.VAGRANT_DIR=`${this.GITHUB_REPO}/vagrant`;
        this.NOT_SUPPORTED_FOLDER=`${this.GITHUB_REPO}/not-supported`;
        this.NCREPO=`https://download.nextcloud.com/server/releases`;
        this.ISSUES=`https://github.com/nextcloud/vm/issues`;

        // User information
        this.REDISUSER = `sudo -u redis `;
        this.WWWDATA = `sudo -u www-data`;
        this.ROOTUSER = `sudo -u root`;
        this.GUIUSER=`ncadmin`;
        this.GUIPASS=`nextcloud`;
        this.UNIXUSER = this.run('echo $SUDO_USER');

        this.UNIXUSER_PROFILE=`/home/${this.UNIXUSER}/.bash_profile`;
        this.ROOT_PROFILE="/root/.bash_profile";

        // User for Bitwarden
        this.BITWARDEN_USER=`bitwarden`;
        this.BITWARDEN_HOME=`/home/${this.BITWARDEN_USER}`;

        // Database
     
        this.SHUF=this.run(`shuf -i 25-29 -n 1`);
        this.PGDB_USER=`${this.NCDBUSER}`; // <- nextcloud_db_user
        this.PGDB_PASS = this.getConfigValue('dbpassword'); // from ncdb()
        this.NEWPGPASS = this.gen(this.SHUF, 'a-zA-Z0-9@#*');
        

        // Path to specific files
        this.SECURE=`${this.SCRIPTS}/setup_secure_permissions_nextcloud.sh`;

        

        // Set the hour for automatic updates. This would be 18:00 as only the hour is configurable.
        this.AUT_UPDATES_TIME=`18`;
        // Keys
        this.OpenPGP_fingerprint='28806A878AE423A28372792ED75899B9A724937A';
        
        // Collabora App
        this.HTTPS_CONF=`${this.SITES_AVAILABLE}/${this.SUBDOMAIN}.conf`;
        this.HTTP2_CONF="/etc/apache2/mods-available/http2.conf";
        // GeoBlock
        this.GEOBLOCK_MOD_CONF="/etc/apache2/conf-available/geoblock.conf";
        this.GEOBLOCK_MOD="/etc/apache2/mods-available/maxminddb.load";
        
        // Notify push
        this.NOTIFY_PUSH_SERVICE_PATH="/etc/systemd/system/notify_push.service";
        // Adminer
        this.ADMINERDIR=`/usr/share/adminer`
        this.ADMINER_CONF=`${this.SITES_AVAILABLE}/adminer.conf`;
        this.ADMINER_CONF_PLUGIN=`${this.ADMINERDIR}/extra_plugins.php`;
        // Redis
        this.REDIS_CONF=`/etc/redis/redis.conf`;
        this.REDIS_SOCK=`/var/run/redis/redis-server.sock`;
        this.REDIS_PASS=`${this.loadVariables('REDIS_PASS')}`;
        // Extra security
        this.SPAMHAUS=`/etc/spamhaus.wl`;
        this.ENVASIVE=`/etc/apache2/mods-available/mod-evasive.load`;
        this.APACHE2=`/etc/apache2/apache2.conf`;

        //Full text search
        this.FULLTEXTSEARCH_DIR = `${this.SCRIPTS}/fulltextsearch`;
        this.NEXTCLOUD_INDEX = this.gen(this.SHUF, '[:lower:]');
        this.ELASTIC_USER_PASSWORD = this.gen(this.SHUF, '[:lower:]');
        this.FULLTEXTSEARCH_IMAGE_NAME = 'fulltextsearch_es01';
        this.FULLTEXTSEARCH_SERVICE = 'nextcloud-fulltext-elasticsearch-worker.service';
        this.DOCKER_IMAGE_NAME = 'es01';
        this.RORDIR = '/opt/es/';
        this.OPNSDIR = '/opt/opensearch';
        this.nc_fts = 'ark74/nc_fts';
        this.opens_fts = 'opensearchproject/opensearch';
        this.fts_node = 'fts_os-node';

        // Talk
        this.TURN_CONF = "/etc/turnserver.conf";
        this.TURN_PORT = 3478;

   

    }
   
    

    
    

    ncdb(NCPATH) {
        let util = new ncUTILS();
        const dbName = util.getConfigValue('dbname');
        //console.log(`Database name: ${dbName}`);
        const dbUser = util.getConfigValue('dbuser');
        const dbPass = util.getConfigValue('dbpassword');
        const dbHost = util.getConfigValue('dbhost');
        const dbType = util.getConfigValue('dbtype');
      
        return {
          NCDB: dbName,
          NCDBUSER: dbUser,
          NCDBPASS: dbPass,
          NCDBHOST: dbHost,
          NCDBTYPE: dbType
        };
      }
      

    // Nextcloud version
    nc_update() {
        
        this.CURRENTVERSION= this.run(`sudo -u www-data php ${this.NCPATH}/occ status | grep "versionstring" | awk '{print $3}'`);
        this.NCVERSION= this.run(`curl -s -m 900 ${this.NCREPO}/ | sed --silent 's/.*href="nextcloud-\([^"]\+\).zip.asc".*/\\1/p' | sort --version-sort | tail -1`);
        this.STABLEVERSION=`nextcloud-${this.NCVERSION}`;
        this.NCMAJOR=this.NCVERSION.split('.')[0];
        this.CURRENTMAJOR=this.CURRENTVERSION.split('.')[0];
        this.NCBAD=parseInt(this.CURRENTMAJOR, 10) - 2;
        this.NCNEXT=this.NCNEXT = parseInt(this.CURRENTMAJOR, 10) + 1;
    }
    
        



    async getNCstate() {
        try {
            const result = execSync('sudo -u www-data php /var/www/nextcloud/occ status').toString().trim();
    
            const versionMatch = result.match(/versionstring:\s+(\S+)/);
            const version = versionMatch ? versionMatch[1] : 'Unknown';

            const installedMatch = result.match(/installed:\s+(true)/);
            const isActive = installedMatch ? 'active' : 'disabled';

            return { state: isActive, version };
        } catch (error) {
            console.error(RED('Failed to fetch Nextcloud status.'), error);
            return { state: 'unknown', version: 'Unknown' };
        }
    }

    async manageVars() {

        await this.util.initialize(this.getAvailableUpdates, 'lastAppUpdateCheck', this);
       
    }

    

   

    /**
 * Asynchronously fetch the available app updates and core updates.
 */
    async getAvailableUpdates() {
        
        try {
            // console.log("Running 'occ update:check' to check for core and app updates...");
            
            // Run the occ update check command
            const output = execSync(`sudo -u www-data php /var/www/nextcloud/occ update:check`, { encoding: 'utf8' });
    
            // Log the output for debugging
            // console.log('OCC update:check output:\n', output);
            
            let updateSummary = '';  
            let coreUpdateText = ''; 
    
            // Fetch the currently installed Nextcloud version for debugging
            const currentVersion = execSync("sudo -u www-data php /var/www/nextcloud/occ status | grep 'versionstring' | awk '{print $3}'").toString().trim();
            // console.log(`Current Nextcloud version installed: ${currentVersion}`);
    
            // Ensure parsing of core updates is correct
            const coreUpdate = output.match(/Nextcloud\s+(\d+\.\d+\.\d+)\s+is available/);
            if (coreUpdate && coreUpdate[1] !== currentVersion) {
                coreUpdateText = `Nextcloud >> ${coreUpdate[1]}`;

                updateSummary += `${coreUpdateText}\n`;

            } else {
                // console.log(`No core update or already on the latest version: ${currentVersion}`);
            }
    
            // Check for app updates
            const appUpdates = output.match(/Update for (.+?) to version (\d+\.\d+\.\d+) is available/g);
            if (appUpdates && appUpdates.length > 0) {
                updateSummary += `${appUpdates.length} app update(s) available.\n`;
    
                appUpdates.forEach(appUpdate => {
                    
                    updateSummary += `Update ${appUpdate.split(' ')[2]} to ${appUpdate.split(' ')[5]}\n`;

                });
            } else {
                console.log('No app updates found.');
            }
    
            if (!coreUpdateText && (!appUpdates || appUpdates.length === 0)) {
                updateSummary = 'No apps or core updates available';
            }
    
            // Store the app update status for display
            this.appUpdateStatus = GREEN(updateSummary.trim());
            
            
          

    
        } catch (error) {
            console.error('Error checking for app updates:', error);
            this.appUpdateStatus = RED('Error checking for app updates.');
        }
    }
    




    /**
     * Fetch Docker container status and format the output.
     */
    getDockerStatus() {
        let dockerStatus;
        try {
            const containerInfo = execSync("docker ps --format '{{.Names}} {{.Ports}}'").toString().trim();
            if (containerInfo) {
                const containers = containerInfo.split('\n').map(container => {
                    const [name, ports] = container.split(' ');
                    const simplifiedName = name.split(/[_-]/)[0];
                    const ipInfo = execSync(`docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${name}`).toString().trim();
                    return { name: PURPLE(simplifiedName), ip: ipInfo, ports };
                });
                dockerStatus = containers.map(container => {
                    return `${BLUE('Container:')} ${PURPLE(container.name)}, ${BLUE('IP:')} ${GREEN(container.ip)}, ${BLUE('Ports:')} ${GREEN(container.ports)}`;
                }).join('\n');
            } else {
                dockerStatus = 'No active containers';
            }
        } catch (error) {
            dockerStatus = PURPLE('Docker is not running or an error occurred');
        }
        return dockerStatus;
    }

    /**
     * Install and configure TURN server for Nextcloud Talk.
     */
    turnInstall() {
        try {
            this.TURN_DOMAIN = this.run(
                `sudo -u www-data php /var/www/nextcloud/occ config:system:get overwrite.cli.url | sed 's|https://||;s|/||'`
            ).trim();
            
            // Generate random secrets
            
            this.TURN_SECRET = this.gen(this.SHUF, "a-zA-Z0-9");
            this.JANUS_API_KEY = this.gen(this.SHUF, "a-zA-Z0-9");
            this.SIGNALING_SECRET = this.gen(this.SHUF, "a-zA-Z0-9");
            this.TURN_INTERNAL_SECRET = this.gen(this.SHUF, "a-zA-Z0-9");
            this.TURN_RECORDING_SECRET = this.gen(this.SHUF, "a-zA-Z0-9");
            
            this.TURN_RECORDING_HOST = "127.0.0.1";
            this.TURN_RECORDING_HOST_PORT = 1234;
            
            // Log generated secrets for debugging purposes
            console.log(`TURN_DOMAIN: ${this.TURN_DOMAIN}`);
            console.log(`TURN_SECRET: ${this.TURN_SECRET}`);
            console.log(`JANUS_API_KEY: ${this.JANUS_API_KEY}`);
            console.log(`SIGNALING_SECRET: ${this.SIGNALING_SECRET}`);
            console.log(`TURN_INTERNAL_SECRET: ${this.TURN_INTERNAL_SECRET}`);
            console.log(`TURN_RECORDING_SECRET: ${this.TURN_RECORDING_SECRET}`);
            console.log(`TURN_RECORDING_HOST: ${this.TURN_RECORDING_HOST}`);
            console.log(`TURN_RECORDING_HOST_PORT: ${this.URN_RECORDING_HOST_PORT}`);


        } catch (error) {
            console.error('Error installing TURN server:', error);
        }
    }

    calculatePHPfpm() {
        // Minimum amount of max children (lower than this won't work with 2 GB RAM)
        const min_max_children = 8;
        const min_start_servers = 20;
        const min_max_spare_servers = 35;
        const average_php_memory_requirement = 50;

        // Get current start, max, min values from nextcloud.conf
        const current_start = parseInt(this.getPhpFpmValue('pm.start_servers')) || 0;
        const current_max = parseInt(this.getPhpFpmValue('pm.max_spare_servers')) || 0;
        const current_min = parseInt(this.getPhpFpmValue('pm.min_spare_servers')) || 0;
        const current_sum = current_start + current_max + current_min;

        // Calculate available memory and max children
        const available_memory = parseInt(execSync("awk '/MemAvailable/ {printf \"%d\", $2/1024}' /proc/meminfo").toString().trim());
        const PHP_FPM_MAX_CHILDREN = Math.max(min_max_children, Math.floor(available_memory / average_php_memory_requirement));

        console.log(CYAN('Automatically configures pm.max_children for php-fpm...'));
        
        if (PHP_FPM_MAX_CHILDREN < min_max_children) {
            console.error(RED(`The current max_children value (${PHP_FPM_MAX_CHILDREN}) is too low for proper functioning.
The minimum value is 8, and it is calculated based on available RAM.`));
            process.exit(1);
        } else {
            // Update max_children
            this.setPhpFpmValue('pm.max_children', PHP_FPM_MAX_CHILDREN);
            console.log(GREEN(`pm.max_children was set to ${PHP_FPM_MAX_CHILDREN}`));

            if (PHP_FPM_MAX_CHILDREN > current_sum) {
                // Set pm.max_spare_servers
                if (PHP_FPM_MAX_CHILDREN >= min_max_spare_servers && current_start < min_start_servers) {
                    this.setPhpFpmValue('pm.max_spare_servers', PHP_FPM_MAX_CHILDREN - 30);
                    console.log(chalk.green(`pm.max_spare_servers was set to ${PHP_FPM_MAX_CHILDREN - 30}`));
                }
            }
        }

        // If PHP_FPM_MAX_CHILDREN is lower than current_sum, revert to defaults
        if (PHP_FPM_MAX_CHILDREN < current_sum) {
            this.resetPhpFpmToDefault();
            console.log(chalk.cyan('All PHP-FPM values were set back to default as pm.max_children was lower than the sum of all current values.'));
        }

        this.run(`sudo systemctl restart apache2 && sudo systemctl restart php${this.PHPVER}-fpm.service`)
    }

    getPhpFpmValue(key) {
        try {
            const value = execSync(`grep ${key} ${this.PHP_POOL_DIR}/nextcloud.conf | awk '{ print $3}'`).toString().trim();
            return value;
        } catch (error) {
            console.error(RED(`Failed to fetch ${key} from nextcloud.conf`), error);
            return null;
        }
    }

    setPhpFpmValue(key, value) {
        try {
            this.run(`sed -i "s|${key}.*|${key} = ${value}|g" ${this.PHP_POOL_DIR}/nextcloud.conf`);
        } catch (error) {
            console.error(RED(`Failed to set ${key} to ${value}`), error);
        }
    }

    resetPhpFpmToDefault() {
        const defaultSettings = {
            'pm.max_children': 8,
            'pm.start_servers': 3,
            'pm.min_spare_servers': 2,
            'pm.max_spare_servers': 3
        };

        for (const [key, value] of Object.entries(defaultSettings)) {
            this.setPhpFpmValue(key, value);
        }
    }


    /**
     * Set the systemd-resolved default DNS servers based on the current
     * internet-facing interface.
     * This is useful for Docker interfaces that might not use the same DNS servers.
     * 
     * @param {string} iface - The name of the network interface (e.g., eth0, enp0s3)
     */
    setSystemdResolvedDNS(iface) {
        try {
            const pattern = `${iface}(?:.|\\n)*?DNS Servers: ((?:[0-9a-f.: ]|\\n)*?)\\s*(?=\\n\\S|\\n.+: |$)`;
            const systemdStatus = execSync('systemd-resolve --status').toString();
            
            // Use regex to extract DNS servers based on the interface
            const regex = new RegExp(pattern, 'm');
            const match = systemdStatus.match(regex);
            let dnss = match ? match[1].replace(/\s+/g, ' ').trim() : null;

            if (dnss) {
                // Update DNS setting in /etc/systemd/resolved.conf
                execSync(`sudo sed -i "s/^#\\?DNS=.*$/DNS=${dnss}/" /etc/systemd/resolved.conf`);
                
                // Restart systemd-resolved to apply the changes
                execSync('sudo systemctl restart systemd-resolved');
                
                // Sleep for 1 second (optional)
                setTimeout(() => {
                    console.log('systemd-resolved DNS settings updated and service restarted.');
                }, 1000);
            } else {
                console.log(`No DNS servers found for interface: ${iface}`);
            }
        } catch (error) {
            console.error('Error setting systemd-resolved DNS:', error);
        }
    }
    
    /**
     * Helper function to execute a shell command and return the output.
     * @param {string} command - The shell command to run.
     * @returns {string} - Output from the command.
     */
    getCommandOutput(command) {
        try {
            return execSync(command).toString().trim();
        } catch (error) {
            console.error(`Error executing command: ${command}`);
            return '';
        }
    }

/**
 * Helper function to get the PostgreSQL version number.
 * @returns {string} - The major version number of PostgreSQL.
 */
getPostgresVersion() {
    try {
        const output = execSync('psql --version').toString().trim();
        const cleanOutput = output.replace(/\s*\(.*?\)/g, ''); 
        const versionMatch = cleanOutput.match(/\bpsql\s+(\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1].split('.')[0] : 'unknown';
        const status = this.getServiceStatus('postgresql');

        return `${version} { ${status} }`;

    } catch (error) {
        console.error('Error occurred while fetching PostgreSQL version:', error);
        return 'unknown { unknown }';
    }
}

    // Load variables from the JSON file
    loadVariables() {
        if (fs.existsSync(this.filePath)) {
            try {
                const data = fs.readFileSync(this.filePath, 'utf8');
                return JSON.parse(data);
            } catch (error) {
                console.error(`Error loading variables from ${this.filePath}:`, error);
                return null;
            }
        } else {
            console.error(`File not found: ${this.filePath}`);
            return null;
        }
    }

    // Save variables to the JSON file
    saveVariables() {
        if (!this.variables) {
            console.error("No variables to save.");
            return;
        }
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.variables, null, 2));
            console.log(`Variables saved to ${this.filePath}`);
        } catch (error) {
            console.error(`Error saving variables to ${this.filePath}:`, error);
        }
    }

    // Update a specific variable and save
    updateVariable(key, value) {
        if (typeof this[key] !== 'function') {
            this.variables[key] = value;
            this.saveVariables();
            console.log(`Updated ${key} to ${value}`);
        } else {
            console.error(`Cannot update '${key}' because it is a method, not a variable.`);
        }
    }

    // Fetch configuration values from config.php
    getConfigValue(key, NCPATH = this.NCPATH) {
        try {
            const configPath = `${NCPATH}/config/config.php`;
            const command = `sudo sed -n "/['\\"]${key}['\\"] =>/,/),/p" ${configPath}`;
            const output = execSync(command).toString().trim();
            if (!output) return null;
            
            // Handle array or single value
            if (output.includes('array (')) {
                const arrayValues = [];
                const arrayMatch = output.match(/\d+\s*=>\s*['"]([^'"]+)['"]/g);
                if (arrayMatch) {
                    arrayMatch.forEach(entry => {
                        const value = entry.split('=>')[1].trim().replace(/['",]/g, '');
                        arrayValues.push(value);
                    });
                }
                return arrayValues;
            } else {
                return output.split('=>')[1].trim().replace(/['",]/g, '');
            }
        } catch (error) {
            console.error(`Error fetching config value for ${key}:`, error);
            return null;
        }
    }

    // Service status checking methods
    getServiceStatus(service) {
        try {
            const status = execSync(`systemctl is-active ${service}`).toString().trim();
            return status === 'active' ? GREEN('active') : RED('inactive');
        } catch (error) {
            console.error(`${service} status check failed:`, error);
            return 'inactive';
        }
    }


    /**
     * Update the SMTP configuration in variables.json.
     * @param {string} mailServer - The SMTP server address.
     * @param {string} protocol - The encryption protocol (SSL, STARTTLS, NO-ENCRYPTION).
     * @param {string} smtpPort - The port used for the SMTP connection.
     * @param {string} mailUsername - The username for the SMTP server.
     * @param {string} mailPassword - The password for the SMTP server.
     * @param {string} recipient - The recipient email address for sending emails.
     */
    updateSMTP(mailServer, protocol, smtpPort, mailUsername, mailPassword, recipient) {
        this.updateVariable('MAIL_SERVER', mailServer);
        this.updateVariable('PROTOCOL', protocol);
        this.updateVariable('SMTP_PORT', smtpPort);
        this.updateVariable('MAIL_USERNAME', mailUsername);
        this.updateVariable('MAIL_PASSWORD', mailPassword);
        this.updateVariable('RECIPIENT', recipient);
    }

    /**
     * Update the Redis configuration in variables.json.
     * @param {string} redisSock - The Redis Unix socket file location.
     * @param {string} redisConf - The Redis configuration file location.
     * @param {string} redisPass - The password for Redis.
     */
    updateRedis() {
        this.ncdb();
        let bak = new ncBAK();
        let redisTools = new ncREDIS();
        let redisServ =new ncRedisServer();
        let redisPASS = redisServ.generateRedisPassword();

        redisTools.updateRedisPasswordInVariables()
        
        


        this.updateVariable(`'REDIS_HOST', ${redisTools.redisSock}`);

        this.updateVariable(`'REDIS_SOCK', ${redisTools.redisSock}`);
        this.updateVariable(`'REDIS_CONF', ${redisTools.redisConf}`)
        execSync(`sudo sed -i "s|# requirepass .*|requirepass ${redisPASS}|g" ${this.REDIS_CONF}`);
        execSync(`sudo -u www-data php /var/www/nextcloud/occ config:system:set redis password --value="${redisPASS}"`);
        this.updateVariable(`'REDIS_PASS', ${redisPASS}`);
        
    }

    /**
     * Generate a random password of a given length using the provided charset.
     * @param {number} length - The length of the password.
     * @param {string} charset - The characters to use in the password.
     * @returns {string} - The generated password.
     */
    genPasswd(length, charset) {
        let password = '';
        while (password.length < length) {
            const randomChar = execSync(`head -c 100 /dev/urandom | LC_ALL=C tr -dc "${charset}"`).toString().trim();
            password += randomChar.slice(0, length - password.length);
        }
        return password;
    }
}


export default ncVARS;
