FROM ubuntu:16.10

RUN apt-get update && \
    apt-get install curl supervisor shadowsocks-libev sudo -y && \
    curl -sL https://deb.nodesource.com/setup_6.x | bash - && \
    apt-get install -y nodejs && \
    npm i -g shadowsocks-manager && \
    systemctl stop shadowsocks-libev

ADD config /etc/shadowsocks
ADD supervisor /etc/supervisor

CMD ["/usr/bin/supervisord"]
