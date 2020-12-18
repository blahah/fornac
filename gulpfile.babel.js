// generated on 2016-01-26 using generator-gulp-webapp 1.1.1
import gulp from 'gulp'
import gulpLoadPlugins from 'gulp-load-plugins'
import browserSync from 'browser-sync'
import del from 'del'
import { stream as wiredep } from 'wiredep'
require('es6-promise').polyfill()

// import browserify from 'gulp-browserify';
// import webpack from 'gulp-webpack';
const webpack = require('webpack-stream')

const $ = gulpLoadPlugins()
const reload = browserSync.reload

gulp.task('styles', () => {
  return gulp.src('app/styles/*.css')
    .pipe($.sourcemaps.init())
    .pipe($.sourcemaps.write())
    .pipe(gulp.dest('.tmp/styles'))
    .pipe(reload({ stream: true }))
})

gulp.task('scripts', () => {
  return gulp.src('app/scripts/**/*.js')
    .pipe($.plumber())
    .pipe($.sourcemaps.init())
    .pipe($.babel())
    .pipe(webpack(require('./webpack.config.js')))
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest('.tmp/scripts'))
    .pipe(reload({ stream: true }))
})

gulp.task('html', gulp.series('styles', 'scripts', () => {
  return gulp.src('app/*.html')
    .pipe($.useref({ searchPath: ['.tmp', 'app', '.'] }))
    .pipe($.debug())
    .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.css', $.cssnano()))
    .pipe($.if('*.html', $.htmlmin({ collapseWhitespace: true })))
    .pipe(gulp.dest('dist'))
}))

gulp.task('buildJs', gulp.series('styles', 'scripts', () => {
  return gulp.src(['.tmp/scripts/rnatreemap.js'])
    .pipe($.uglify())
    .pipe(gulp.dest('dist/scripts'))
}))

gulp.task('images', () => {
  return gulp.src('app/images/**/*')
    .pipe($.if($.if.isFile, $.cache($.imagemin({
      progressive: true,
      interlaced: true,
      // don't remove IDs from SVGs, they are often used
      // as hooks for embedding and styling
      svgoPlugins: [{ cleanupIDs: false }]
    }))
      .on('error', function (err) {
        console.log(err)
        this.end()
      })))
    .pipe(gulp.dest('dist/images'))
})

gulp.task('fonts', () => {
  return gulp.src(require('main-bower-files')('**/*.{eot,svg,ttf,woff,woff2}', function (err) {})
    .concat('app/fonts/**/*'))
    .pipe(gulp.dest('.tmp/fonts'))
    .pipe(gulp.dest('dist/fonts'))
})

gulp.task('extras', () => {
  return gulp.src([
    'app/*.*',
    '!app/*.html'
  ], {
    dot: true
  }).pipe(gulp.dest('dist'))
})

gulp.task('clean', del.bind(null, ['.tmp', 'dist']))

gulp.task('serve', gulp.series('styles', 'scripts', 'fonts', () => {
  browserSync({
    notify: false,
    port: 9000,
    server: {
      baseDir: ['.tmp', 'app'],
      routes: {
        '/bower_components': 'bower_components'
      }
    }
  })

  gulp.watch([
    'app/*.html',
    '.tmp/scripts/**/*.js',
    'app/images/**/*',
    '.tmp/fonts/**/*'
  ]).on('change', reload)

  gulp.watch('app/styles/**/*.css', gulp.series('styles'))
  gulp.watch('app/scripts/**/*.js', gulp.series('scripts'))
  gulp.watch('app/fonts/**/*', gulp.series('fonts'))
  gulp.watch('bower.json', gulp.series('wiredep', 'fonts'))

  gulp.watch('app/scripts/**/*.js', gulp.series('test'))
  gulp.watch('test/**/*.js', gulp.series('test'))
}))

gulp.task('serve:dist', () => {
  browserSync({
    notify: false,
    port: 9000,
    server: {
      baseDir: ['dist']
    }
  })
})

gulp.task('serve:test', gulp.series('scripts', () => {
  browserSync({
    notify: false,
    port: 9000,
    ui: false,
    server: {
      baseDir: 'test',
      routes: {
        '/scripts': '.tmp/scripts',
        '/bower_components': 'bower_components'
      }
    }
  })

  gulp.watch('app/scripts/**/*.js', ['scripts'])
  gulp.watch('test/spec/**/*.js').on('change', reload)
}))

// inject bower components
gulp.task('wiredep', () => {
  gulp.src('app/*.html')
    .pipe(wiredep({
      ignorePath: /^(\.\.\/)*\.\./
    }))
    .pipe(gulp.dest('app'))
})

gulp.task('build', gulp.series('html', 'buildJs', 'images', 'fonts', 'extras', () => {
  return gulp.src('dist/**/*').pipe($.size({ title: 'build', gzip: true }))
}))

gulp.task('default', gulp.series('clean', () => {
  gulp.start('build')
}))

gulp.task('test', gulp.series('scripts', () => {
  gulp.src('test/**/*.js')
    .pipe($.jasmine())
}))

gulp.task('test-serve', gulp.series('test', () => {
  gulp.watch(['app/scripts/**/*.js', 'test/**/*.js'], ['test'])
}))
