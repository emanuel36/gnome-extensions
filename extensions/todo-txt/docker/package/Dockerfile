FROM debian:sid-slim
MAINTAINER Bart Libert <bart.libert@gmail.com>

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update && apt-get install -y -qq --no-install-recommends python3 python3-lxml git moreutils zip unzip python3-six jq libglib2.0-bin
RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /usr/share/man/?? /usr/share/man/??_*
