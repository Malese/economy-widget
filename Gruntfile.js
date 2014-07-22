/*global module:false*/

/* See
   http://blog.nodejitsu.com/package-dependencies-done-right
   for best practicies regarding dependency version syntax and semver. */
module.exports = function(grunt) {

  'use strict';

  // Load the ssh/sftp tasks remote hosts configs.
  var remoteHosts = grunt.file.readJSON('remote-hosts.json');
  for ( var remoteHost in remoteHosts ) {
    if ( remoteHosts[remoteHost].hasOwnProperty('privateKey') ) {
      remoteHosts[remoteHost].privateKey = grunt.file.read(remoteHosts[remoteHost].privateKey);
    }
  }

  // Get OSX wireless ip (en1) for use in browserSync.
  var wirelesip = '';
  function setWifiIp(err, stdout, stderr, cb) {
    wirelesip = stdout;
    cb();
  }


  // Project configuration.
  grunt.initConfig({

    // Metadata.
    pkg: grunt.file.readJSON('package.json'),

    // Remote hosts configuration. See README.md
    sshconfig: remoteHosts,

    wirelesip: wirelesip,

    banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
      '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
      '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
      '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.people.author.name %>;' +
      ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */\n',

    // // Task configuration.

    // https://www.npmjs.org/package/grunt-shell
    // For OSX. This will need hacking to work with linux/win.
    shell: {
      wifiip: {
        command: 'ipconfig getifaddr en1',
        options: {
          callback: setWifiIp
          // ,
          // stdout: false
        }
      }
    },


    // https://npmjs.org/package/grunt-contrib-jshint
    jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        unused: true,
        boss: true,
        eqnull: true,
        browser: true
      },
      gruntfile: {
        src: 'Gruntfile.js'
      }
    },


    // https://npmjs.org/package/grunt-contrib-watch
    watch: {
      styles: {
        files: ['widget/styles/**/*'],
        tasks: ['autoprefixer']
      },
      statics: {
        files: ['widget/images/**/*', 'widget/bower_components/**/*'],
        tasks: ['copy']
      },
      bake: {
        files: ['<%= bake.build.files[0].cwd %>**/*.html', '<%= bake.build.files[0].cwd %>**/*.json'],
        tasks: ['bake:build']
      },
      gruntfile: {
        files: '<%= jshint.gruntfile.src %>',
        tasks: ['jshint:gruntfile']
      }
    },


    // http://www.browsersync.io
    // Replaces connect (server), reload (livereload) and Adobe Shadow (test on multiple devices)
    browserSync: {
      options: {
        startPath: '/example.html',
        watchTask: true,
        server: {
          baseDir: 'dist'
        },
        ghostMode: {
          location: true
        },
        host: wirelesip
      },
      bsFiles: {
        src: ['dist/**/*.*']
      }
    },

    // https://www.npmjs.org/package/grunt-autoprefixer
    autoprefixer: {
      css: {
        options: {
          map: true
        },
        src: 'widget/styles/economy-widget.css',
        dest: 'dist/styles/economy-widget.css'
      }
    },

    // https://npmjs.org/package/grunt-bake
    bake: {
      build: {
        options: {
          content: 'widget/bake-content.json'
        },
        files: [
          {
            expand: true,
            cwd: 'widget/',
            src: ['*.html'],
            dest: 'dist',
            ext: '.html'
          }
        ]
      }
    },

    // Shuffle files between dirs.
    // https://npmjs.org/package/grunt-contrib-copy
    copy: {
      statics: {
        files: [
          {
            expand: true,
            cwd: 'widget/',
            src: [
              'images/**/*.*',
              'scripts/**/*.js',
              '!bower_components/**/*.*', // not the whole bower_components, the speciffic lib-files only.
              'bower_components/respond/dest/respond.min.js',
              'bower_components/normalize.css/normalize.css'
            ],
            dest: 'dist/'
          }
        ]
      }
    },

    // https://npmjs.org/package/grunt-ssh
    // Possibly ad more targets here, like the Jenkins server.
    // Then also populate remote-hosts.json with associated credentials.
    sftp: {
      options: {
        showProgress: true
      },
      sandbox: {
        files: { './': ['dist/**'] },
        options: {
          path: '/mnt/hdstatic/sandbox/<%= pkg.name %>/',
          createDirectories: true,
          srcBasePath: 'dist/',
          config: 'interact'
        }
      }
    },

    sshexec: {
      cleansandbox: {
        command: 'rm -rf <%= sftp.sandbox.options.path %>*',
        options: {
          config: '<%= sftp.sandbox.options.config %>'
        }
      }
    },

    // https://npmjs.org/package/grunt-contrib-clean
    clean: {
      dist: ['dist/*']
    }

  });


  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-autoprefixer');
  grunt.loadNpmTasks('grunt-bake');
  grunt.loadNpmTasks('grunt-browser-sync');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-ssh');



  grunt.registerTask('echoDefualtTask', function() {
    grunt.log.subhead('Default task - code correctness check');
    grunt.log.writeln('If this passes without error, the code should be mostly ok.');
  });


  // DEFAULT TASK.
  grunt.registerTask('default', ['echoDefualtTask', 'dist']);// 'jshint', 'qunit', 'concat', 'uglify', 'compass:dist']


  // DEV-TASKS
  grunt.registerTask('dist', ['jshint', 'clean', 'bake', 'autoprefixer', 'copy']); // imagemin not installable under node > ~10
  grunt.registerTask('server', ['dist', 'shell:wifiip', 'browserSync', 'watch']);


  // SANDBOX - Clean out package-folder from sandbox @ interact.
  grunt.registerTask('cleansandbox', ['sshexec:cleansandbox']);
  // Push dist/ to sandbox @ interact.
  grunt.registerTask('tosandbox', ['cleansandbox', 'sftp:sandbox']); // 'sshexec:cleansandbox', 'sftp:sandbox'


};
