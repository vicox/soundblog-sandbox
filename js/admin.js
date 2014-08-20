(function() {

    var next = window.location.hash = (window.location.hash != '#/login') ? window.location.hash : '';
    window.location.hash = '#/login';

    var branch;

    var LoginView = Backbone.View.extend({
        el: '.github',
        events: {
            'submit .login': 'submit'
        },
        submit: function (e) {
            e.preventDefault();

            var $form = $(e.currentTarget);
            disableForm($form);

            var username = $form.find('#username').val();
            var password = $form.find('#password').val();

            if (username && password) {
                var github = new Octokit({
                    username: username,
                    password: password
                });

                var repo = github.getRepo(this.$el.data('username'), this.$el.data('repo'));

                repo.canCollaborate().then(function(canCollaborate) {
                    if (canCollaborate) {
                        branch = repo.getBranch("master");
                        window.location.hash = next;

                    } else {
                        formError($form, 'You are not a collaborator of this repository');
                    }
                }).fail(function() {
                    formError($form, 'Incorrect Github credentials');
                });

            } else {
                formError($form, 'Username and password are required');
            }
        },
        render: function (options) {
            this.$el.html($('#login-template').html());
        }
    });

    var PostsView = Backbone.View.extend({
        el: '.github',
        render: function (options) {
            var that = this;
            branch.contents('_posts')
                .then(function (files) {
                    files = JSON.parse(files);
                    files = _.sortBy(files, function(file){ return file.name });
                    files.reverse();
                    var template = _.template($('#posts-template').html(), {files: files});
                    that.$el.html(template);
                }).fail(function() {
                    var template = _.template($('#posts-template').html());
                    that.$el.html(template);
                });
        }
    });

    var PostShowView = Backbone.View.extend({
        el: '.github',
        render: function (options) {
            var that = this;
            branch.contents('_posts/' + options.fileName)
                .then(function (content) {
                    var template = _.template($('#post-show-template').html(), {post: {
                        fileName: options.fileName,
                        meta: contentToMap(content, true)}});
                    that.$el.html(template);
                });
        }
    });

    var PostEditView = Backbone.View.extend({
        el: '.github',
        events: {
            'submit .edit-post': 'submit'
        },
        submit: function (e) {
            e.preventDefault();

            var $form = $(e.currentTarget);
            disableForm($form);

            var fileName = $form.find('#fileName').val();
            var title = $form.find('#title').val();
            var date = $form.find('#date').val();

            branch.contents('_posts/' + fileName)
                .then(function (content) {
                    var metaMap = contentToMap(content);
                    metaMap['title'] = '"' + title + '"';
                    metaMap['date'] = date;

                    var newContent = mapToContent(metaMap);

                    var dayFromDate = date.substring(0, 10);
                    if (fileName.indexOf(dayFromDate) == 0) {
                        branch.write('_posts/' + fileName, newContent, 'edit post', false)
                            .then(function() {
                                window.location.hash = '#/show/' +fileName;
                            });
                    } else {
                        var newFileName = dayFromDate + fileName.substring(10, fileName.length);
                        branch.write('_posts/' + newFileName, newContent, 'create post', false)
                            .then(function() {
                                branch.remove('_posts/' + fileName, 'delete post')
                                    .then(function() {
                                        window.location.hash = '#/show/' + newFileName;
                                    });
                            });
                    }
                });


        },
        render: function (options) {
            var that = this;
            branch.contents('_posts/' + options.fileName)
                .then(function (content) {
                    var template = _.template($('#post-edit-template').html(), {post: {
                        fileName: options.fileName,
                        meta: contentToMap(content, true)}});
                    that.$el.html(template);
                });
        }
    });

    var PostDeleteView = Backbone.View.extend({
        el: '.github',
        events: {
            'submit .delete-post': 'submit'
        },
        submit: function (e) {
            e.preventDefault();

            var $form = $(e.currentTarget);
            disableForm($form);

            var fileName = $form.find('#fileName').val();

            branch.remove('_posts/' + fileName, 'delete post')
                .then(function() {
                    window.location.hash = '#';
                });


        },
        render: function (options) {
            var that = this;
            branch.contents('_posts/' + options.fileName)
                .then(function (content) {
                    var template = _.template($('#post-delete-template').html(), {post: {
                        fileName: options.fileName,
                        meta: contentToMap(content, true)}});
                    that.$el.html(template);
                });
        }
    });

    var PostCreateView = Backbone.View.extend({
        el: '.github',
        events: {
            'submit .create-post': 'submit',
            'submit .docreate-post': 'create'
        },
        submit: function (e) {
            e.preventDefault();

            var $form = $(e.currentTarget);
            disableForm($form);

            var url = $form.find('#url').val();

            SC.initialize({
                client_id: this.$el.data('soundcloud-client-id')
            });

            var that = this;
            SC.get("/resolve", {url: url}, function(track){
                var template = _.template($('#post-docreate-template').html(), {
                    title: track.title,
                    date: formatLocalDate(),
                    id: track.id,
                    kind: track.kind,
                    permalink: track.user.permalink + '-' + track.permalink,
                    url: url
                });
                that.$el.html(template);
            });


        },
        create: function (e) {
            e.preventDefault();

            var $form = $(e.currentTarget);
            disableForm($form);

            var title = $form.find('#title').val();
            var date = $form.find('#date').val();
            var id = $form.find('#id').val();
            var kind = $form.find('#kind').val();
            var url = $form.find('#url').val();

            var map = {};
            map['layout'] = 'post';
            map['title'] = '"' + title + '"';
            map['date'] = date;
            map['track_id'] = id;
            if ('track' != kind) {
                map['track_kind'] = kind;

            }
            map['track_url'] = url;

            var dayFromDate = date.substring(0, 10);
            var fileName = dayFromDate + '-' + $form.find('#permalink').val() + '.md';

            branch.write('_posts/' + fileName, mapToContent(map), 'new post', false)
                .then(function() {
                    window.location.hash = '#/show/' + fileName;
                });


        },
        render: function () {
            this.$el.html($('#post-create-template').html());
        }
    });

    var Router = Backbone.Router.extend({
        routes: {
            "login": "login",
            "": "posts",
            "show/:fileName": "show",
            "edit/:fileName": "edit",
            "delete/:fileName": "delete",
            "create": "create"
        }
    });

    var router = new Router();
    router.on('route:login', function () {
        new LoginView().render();
    });
    router.on('route:posts', function () {
        new PostsView().render();
    });
    router.on('route:show', function (fileName) {
        new PostShowView().render({fileName: fileName});
    });
    router.on('route:edit', function (fileName) {
        new PostEditView().render({fileName: fileName});
    });
    router.on('route:delete', function (fileName) {
        new PostDeleteView().render({fileName: fileName});
    });

    router.on('route:create', function () {
        new PostCreateView().render();
    });

    Backbone.history.start();


    function contentToMap(content, shouldStripQuotes) {
        var map = {};
        var lines = content.split('\n');
        for (var i = 0; i < lines.length; i++) {
            if (lines[i].indexOf(':') > 0) {
                var key = lines[i].substring(0, lines[i].indexOf(':'));
                var value = lines[i].substring(lines[i].indexOf(':') + 1, lines[i].length);
                value = stripWhitespaces(value);
                if (typeof shouldStripQuotes !== 'undefined' && shouldStripQuotes) {
                    value = stripQuotes(value);
                }
                map[key] = value;
            }
        }
        return map;
    }

    function mapToContent(map) {
        var content = '---\n';
        for (var key in map) {
            content += key +': ' + map[key] + '\n';
        }
        content += '---';
        return content;
    }

    function stripWhitespaces(s) {
        return s.replace(/^\s+|\s+$/g, '');
    }

    function stripQuotes(s) {
        return s.replace(/^"+|"+$/g, '');
    }

    function disableForm($form) {
        $form.find('button[type=submit]').button('loading');
        $form.find('input').prop('disabled', true);
    }

    function enableForm($form) {
        $form.find('button[type=submit]').button('reset');
        $form.find('input').prop('disabled', false);
    }

    function formError($form, error) {
        $form.find('.error').remove();
        $form.prepend(_.template($('#error-template').html(), {error: error}));
        enableForm($form);
    }

    function pad(num) {
        norm = Math.abs(Math.floor(num));
        return (norm < 10 ? '0' : '') + norm;
    }

    function formatLocalDate() {
        var local = new Date();
        var tzo = -local.getTimezoneOffset();
        var sign = tzo >= 0 ? '+' : '-';
        return local.getFullYear()
            + '-' + pad(local.getMonth()+1)
            + '-' + pad(local.getDate())
            + ' ' + pad(local.getHours())
            + ':' + pad(local.getMinutes())
            + ':' + pad(local.getSeconds())
            + ' ' +sign + pad(tzo / 60) + pad(tzo % 60);
    }

})();