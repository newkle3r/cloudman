import ncVARS from "./ncVARS";
  
/*
    function loadVariables() {
        try {
            const data = fs.readFileSync('./variables.json', 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading variables.json:', error);
            return {};
        }
    }
    // Load variables from variables.json
    const varsclass = ncVARS();
    const vars = loadVariables();


    const distro = varsclass.DISTRO;
    console.log(distro)
    const address = varsclass.ADDRESS;
    console.log(adress)
    const ipv4 = varsclass.WANIP4;
    console.log(ipv4)
    const psql = vars.PSQLVER; // Assuming this contains the version number, e.g., "14"
    console.log(psql)
    
    // Get the PostgreSQL version string
    const psqlVersion = execSync("psql --version").toString().trim();  // This will return full version info, e.g., "psql (PostgreSQL) 14.13 (Ubuntu 14.13-0ubuntu0.22.04.1)"
    const postgresqlStatus = execSync("systemctl status postgresql | grep Active | awk '{print $2}'").toString().trim();
    const psqlStatus = GREEN(`postgreSQL v.${psql}: ${postgresqlStatus}`);
    const redis = execSync("systemctl status redis-server | grep Active | awk '{print $2}'")
    const apache2 = execSync("systemctl status apache2 | grep Active | awk '{print $2}'")
    

    const phpVersion = vars.PHP || 'Unknown PHP';
    const domain = vars.TLSDOMAIN || 'No Domain';
    const ports = vars.NONO_PORTS || [80, 443];
    const redisSock = vars.REDIS_SOCK || 'No Redis';

    const wan = vars.WANIP4 || 'disconnected';

    // Create status indicators for each component
    const phpStatus = await checkComponent(`php -v | grep ${phpVersion}`) ? GREEN(`[${phpVersion}]`) : RED(`[${phpVersion}]`);
    const domainStatus = domain !== 'No Domain' ? GREEN(`[${domain}]`) : RED(`[${domain}]`);
    const dockerStatusText = dockerStatus ? GREEN(`[docker]`) : RED(`[No Docker]`);
    const wanStatus = GREEN(`[${wan}]`);

   */