FROM registry.gitlab.com/todo.txt-gnome-shell-extension/todo-txt-gnome-shell-extension/jasmine-gjs:latest
MAINTAINER Bart Libert <bart.libert@gmail.com>

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update && apt-get install -y -qq --no-install-recommends libglib2.0-bin xvfb xauth dbus-x11 lcov python3-pip make gir1.2-gtk-4.0 pipx

RUN pipx ensurepath
RUN pipx install lcov_cobertura

RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /usr/share/man/?? /usr/share/man/??_*
