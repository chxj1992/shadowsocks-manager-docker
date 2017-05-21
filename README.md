This is a docker image of [shadowsocks-manager webui plugin](https://github.com/shadowsocks/shadowsocks-manager)

### Supported tags

* 0.1.0

### Quick Start

`docker run --rm -it --name shadowsocks-manager -p 4002:4002 chxj1992/shadowsocks-manager-docker:0.1.0`

open `http://localhost:4002` in browser

check a [demo](http://fuck-the-wall.chxj.name)

### Default ports

* `8388` shadowsocks ssserver port
* `4001` shadowsocks ss-manager port
* `4002` shadowsocks-manager webapp port
* `9001` supervisor admin port

### Directories

* `/etc/supervisor` supervisord configurations
* `/etc/shadowsocks` shadowsocks & shadowsocks-manager configurations [(check the example)](https://github.com/chxj1992/shadowsocks-manager-docker/tree/master/config)
* `/root/.ssmgr` shadowsocks-manager data folder
* `/var/www/shadowsocks-manager` shadowsocks-manager code folder

### docker-compose.yml example

``` yaml 

version: '2'                                                                                                                                    
                                                                                                                                                
services:                                                                                                                                       
  shadowsocks-manager:                                                                                                                          
    image: chxj1992/shadowsocks-manager-docker:0.1.0                                                                                                                                
    container_name: shadowsocks-manager                                                                                                         
    ports:                                                                                                                                      
      - "8388:8388"                                                                                                                             
      - "4001:4001"                                                                                                                             
      - "4002:4002"                                                                                                                             
      - "9001:9001"                                                                                                                             
    volumes:                                                                                                                                    
      - $PWD/supervisor:/etc/supervisor                                                                                                         
      - $PWD/config:/etc/shadowsocks                                                                                                            
      - $PWD/data:/root/.ssmgr                                                                                                                  
      - $PWD/code:/var/www/shadowsocks-manager                                                                                                  
    restart: always  
  
```

### Screenshot

![screenshot](https://github.com/chxj1992/shadowsocks-manager-docker/raw/master/screenshot.png)
