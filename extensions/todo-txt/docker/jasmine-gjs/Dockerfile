FROM debian:sid-slim
MAINTAINER Bart Libert <bart.libert@gmail.com>

ENV DEBIAN_FRONTEND noninteractive

WORKDIR /tmp
RUN apt-get update && apt-get install -y -qq --no-install-recommends curl ca-certificates gjs make meson ninja-build
RUN curl -L https://github.com/ptomato/jasmine-gjs/archive/master.tar.gz -o jasmine.tar.gz
RUN mkdir jasmine-gjs && cd jasmine-gjs && tar --strip-components=1 -xf ../jasmine.tar.gz && meson _build && ninja -C _build && ninja -C _build install

RUN apt-get purge -qq -y curl ca-certificates autoconf automake make && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /usr/share/man/?? /usr/share/man/??_* /tmp/jasmine*
