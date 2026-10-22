FILES=$(shell find -iname '*.js' -and -not \( -name 'run.js' -or -path ./third_party/\* -or -path ./node_modules/\* \))
LCOV_OUTPUT=$(if $(LCOV_DIR),$(LCOV_DIR),.coverage)

.PHONY: test check
help:
	@printf "Following targets are available:\n"
	@printf "\thelp      show this help (default action if no target specified)\n"
	@printf "\ttest      run unit tests\n"
	@printf "\tcheck     perform eslint checks on project code\n"
	@printf "\tbeautify  style the code with eslint\n"
	@printf "\tdep       download and setup external dependencies\n"
	@printf "\tclean     remove all temporary files (*.rej, *.orig, *.porig, *~)\n"
	@printf "\trealclean remove all temporary files and external dependencies\n"
	@printf "\trelease   tags repo with new version and creates a new zip file for distribution\n"
	@printf "\tvalidate  validates settings.json file\n"
	@printf "\txml       creates settings xml file, based on json file\n"
	@printf "\tschema    compiles settings xml into schema\n"
	@printf "\tprefs_ui   create prefs.xml ui file\n"
	@printf "\tinstall   prepares directory to be used as extension in gnome-shell\n"

test:
	@$(if $(COVERAGE),rm -rf $(LCOV_OUTPUT),)
	@$(if $(COVERAGE),GJS_COVERAGE_PREFIXES=libs GJS_COVERAGE_OUTPUT=$(LCOV_OUTPUT),) $(RUNNER) $(firstword $(JASMINE) jasmine) $(if $(MAKE_TERMOUT),--color,--no-color) $(if $(V),--verbose,) --module --config tests/jasmine.json
	@$(if $(COVERAGE),lcov -r $(LCOV_OUTPUT)/coverage.lcov "**/third_party/**/*" "**/unit/**/*" "**/spec/*" "**/org/gnome/**" -o $(LCOV_OUTPUT)/coverage.lcov)

coverage: COVERAGE=1
coverage: test
	@lcov --list $(LCOV_OUTPUT)/coverage.lcov

html-coverage: coverage
	@rm -rf coverage
	@$(firstword $(GEN_HTML) genhtml) --output-directory coverage --branch-coverage $(LCOV_OUTPUT)/coverage.lcov

clean:
	@find \( -name '*.rej' -or -name '*.orig' -or -name '*.porig' -or -name '*~' \) -exec rm -v '{}' \;
	@rm -rfv $(LCOV_OUTPUT)

realclean: clean
	@git submodule deinit --all
	@rm -rfv schemas
	@rm -rfv coverage

check:
	@$(if $(shell command -v $(ESLINT) 2> /dev/null),$(ESLINT),\
		$(if $(shell command -v eslint 2> /dev/null),eslint,\
			$(if $(shell command -v npx 2> /dev/null),npx eslint,\
				$(if $(shell command -v npm 2> /dev/null),$(shell npm bin)/eslint,\
					"**Eslint not found**"\
				)\
			)\
		)\
	)\
	$(if $(FIX),--fix,) $(FILES)


beautify: FIX=1
beautify: check

release:
	@./tools/make_release.sh

dep:
	@./tools/get_libs.sh

validate:
	@python ./tools/validate_settings.py

xml:
	@python ./tools/json2schema.py

schema: xml
	@glib-compile-schemas schemas

prefs_ui:
	@python ./preferences/createPrefsTemplate.py

install: realclean dep schema prefs_ui
