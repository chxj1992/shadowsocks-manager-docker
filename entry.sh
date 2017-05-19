#!/bin/bash

cd /etc/shadowsocks 
cp -n ssmgr.yml.example ssmgr.yml 
cp -n webui.yml.example webui.yml 
cp -n ss-server.json.example ss-server.json

/usr/bin/supervisord -c /etc/supervisor/supervisord.conf

