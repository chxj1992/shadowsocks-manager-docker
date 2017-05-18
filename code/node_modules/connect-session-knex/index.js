'use strict';
var util = require('util');

var oneDay = 86400000;

module.exports = function(connect) {

	/**
	* Connect's Store.
	*/
	var Store = (connect.session) ? connect.session.Store : connect.Store;

	/*
	* Return datastore appropriate string of the current time
	* @api private
	* @return {String | date}
	*/
	function dateAsISO(knex, aDate) {
		var date;
		if (aDate != null) {
			date = new Date(aDate);
		} else {
			date = new Date();
		}
		if(isOracle(knex)){
			return date;
		}
		return isMySQL(knex) ? date.toISOString().slice(0, 19).replace('T', ' ') : date.toISOString();
	}

	/*
	* Return dialect-aware type name for timestamp
	* @return {String} type name for timestamp
	* @api private
	*/
	function timestampTypeName(knex) {
		return isMySQL(knex) ? 'DATETIME' : knex.client.dialect === 'postgresql' ? 'timestamp with time zone' : 'timestamp';
	}

	/*
	 * Return condition for filtering by expiration
	 * @return {String} expired sql condition string
	 * @api private
	 */
	function expiredCondition(knex) {
		var condition ='CAST(? as '+timestampTypeName(knex)+') <= expired';
		if(isSqlite3(knex)) { 	// sqlite3 date condition is a special case.
			condition = 'datetime(?) <= datetime(expired)';
		} else if (isOracle(knex)) {
			condition = 'CAST(? as '+timestampTypeName(knex)+') <= "expired"';
		}
		return condition;
	}

	/*
	* Returns true if the specified knex instance is using sqlite3.
	* @return {bool}
	* @api private
	*/
	function isSqlite3(knex) {
		return knex.client.dialect === 'sqlite3';
	}

	/*
	* Returns true if the specified knex instance is using sqlite3.
	* @return {bool}
	* @api private
	*/
	function isMySQL(knex) {
		return ['mysql', 'mariasql', 'mariadb'].indexOf(knex.client.dialect) > -1;
	}

	/*
	* Returns true if the specified knex instance is using oracle.
	* @return {bool}
	* @api private
	*/
	function isOracle(knex) {
		return ['oracle', 'oracledb'].indexOf(knex.client.dialect) > -1;
	}

	/*
	* Remove expired sessions from database.
	* @param {Object} store
	* @param {number} interval
	* @api private
	*/
	function dbCleanup(store, interval) {
		return store.ready.then(function () {
			var condition = 'expired < CAST(? as ' + timestampTypeName(store.knex) + ')';
			if(isSqlite3(store.knex)) { 	// sqlite3 date condition is a special case.
				condition = 'datetime(expired) < datetime(?)';
			} else if (isOracle(store.knex)) {
				condition = '"expired" < CAST(? as ' + timestampTypeName(store.knex) + ')';
			}
			return store.knex(store.tablename).del()
			.whereRaw(condition, dateAsISO(store.knex));
		}).finally(function() {
			setTimeout(dbCleanup, interval, store, interval).unref()
		});
	}

	/*
	* Initialize KnexStore with the given options.
	*
	* @param {Object} options
	* @api public
	*/
	function KnexStore(options) {
		var self = this;

		options = options || {};
		Store.call(self, options);

		if (!options.clearInterval) {
			// Time to run clear expired function.
			options.clearInterval =  60000;
		}

		self.createtable = options.hasOwnProperty('createtable') ? options.createtable :  true;
		self.tablename = options.tablename || 'sessions';
		self.sidfieldname = options.sidfieldname || 'sid';
		self.knex = options.knex || require('knex')({
			client: 'sqlite3',
			// debug: true,
			connection: {
				filename: "connect-session-knex.sqlite"
			}
		});

		self.ready = self.knex.schema.hasTable(self.tablename)
		.then(function (exists) {
			if (!exists && self.createtable) {
				return self.knex.schema.createTable(self.tablename, function (table) {
					table.string(self.sidfieldname).primary();
					table.json('sess').notNullable();
					if (['mysql', 'mariasql'].indexOf(self.knex.client.dialect) > -1) {
						table.dateTime('expired').notNullable().index();
					} else {
						table.timestamp('expired').notNullable().index();
					}
				});
			}
			return exists;
		})
		.then(function (exists) {
			if (exists) {
				dbCleanup(self, options.clearInterval);
			}
			return null;
		});
	}

	// KnexStore.prototype.__proto__ = Store.prototype;
	util.inherits(KnexStore, Store);

	/*
	* Attempt to fetch session by the given sid.
	*
	* @param {String} sid
	* @param {Function} fn
	* @api public
	*/
	KnexStore.prototype.get = function(sid, fn) {
		var self = this;
		return self.ready.then(function () {
			var condition = expiredCondition(self.knex);
			return self.knex
			.select('sess')
			.from(self.tablename)
			.where(self.sidfieldname, '=', sid)
			.andWhereRaw(condition, dateAsISO(self.knex))
			.then(function (response) {
				var ret;
				if (response[0]) {
					ret = response[0].sess;
					if (typeof ret === "string") {
						ret = JSON.parse(ret);
					}
				}
				return ret;
			})
			.asCallback(fn)
		});
	};


	/*
	* Commit the given `sess` object associated with the given `sid`.
	*
	* @param {String} sid
	* @param {Session} sess
	* @param {Function} fn
	* @api public
	*/
	KnexStore.prototype.set = function(sid, sess, fn) {
		var self = this;
		var maxAge = sess.cookie.maxAge;
		var now = new Date().getTime();
		var expired = maxAge ? now + maxAge : now + oneDay;
		sess = JSON.stringify(sess);
		var postgresfastq = 'with new_values (' + self.sidfieldname + ', expired, sess) as (' +
		'  values (?, ?::timestamp with time zone, ?::json)' +
		'), ' +
		'upsert as ' +
		'( ' +
		'  update ' + self.tablename + ' cs set ' +
		'    ' + self.sidfieldname + ' = nv.' + self.sidfieldname + ', ' +
		'    expired = nv.expired, ' +
		'    sess = nv.sess ' +
		'  from new_values nv ' +
		'  where cs.' + self.sidfieldname + ' = nv.' + self.sidfieldname + ' ' +
		'  returning cs.* ' +
		')' +
		'insert into ' + self.tablename + ' (' + self.sidfieldname + ', expired, sess) ' +
		'select ' + self.sidfieldname + ', expired, sess ' +
		'from new_values ' +
		'where not exists (select 1 from upsert up where up.' + self.sidfieldname + ' = new_values.' + self.sidfieldname + ')';

		var sqlitefastq = 'insert or replace into ' + self.tablename + ' (' + self.sidfieldname + ', expired, sess) values (?, ?, ?);';

		var mysqlfastq = 'insert into ' + self.tablename + ' (' + self.sidfieldname + ', expired, sess) values (?, ?, ?) on duplicate key update expired=values(expired), sess=values(sess);';

		var dbDate = dateAsISO(self.knex, expired);

		if (self.knex.client.dialect === 'sqlite3') {
			// sqlite optimized query
			return self.ready.then(function () {
				return self.knex.raw(sqlitefastq, [sid, dbDate, sess ])
				.then(function (result) {
					return [1];
				})
				.asCallback(fn);
			});
		} else if (self.knex.client.dialect === 'postgresql' && parseFloat(self.knex.client.version) >= 9.2) {
			// postgresql optimized query
			return self.ready.then(function () {
				return self.knex.raw(postgresfastq, [sid, dbDate, sess ])
				.asCallback(fn);
			});
		} else if (['mysql', 'mariasql'].indexOf(self.knex.client.dialect) > -1) {
			// mysql/mariaDB optimized query
			return self.ready.then(function () {
				return self.knex.raw(mysqlfastq, [sid, dbDate, sess ])
				.asCallback(fn);
			});
		} else {
			return self.ready.then(function () {
				return self.knex.transaction(function (trx) {
					return trx.select('*')
					.forUpdate()
					.from(self.tablename)
					.where(self.sidfieldname, '=', sid)
					.then(function (foundKeys) {
						if (foundKeys.length === 0) {
							return trx.from(self.tablename)
							.insert({
								[self.sidfieldname]: sid,
								expired: dbDate,
								sess: sess
							});
						} else {
							return trx(self.tablename)
							.where(self.sidfieldname, '=', sid)
							.update({
								expired: dbDate,
								sess: sess
							});
						}
					});
				})
				.asCallback(fn)
			});
		}
	};


	/**
	 * Touch the given session object associated with the given session ID.
	 *
	 * @param {String} sid
	 * @param {Session} sess
	 * @param {Function} fn
	 * @public
	 */
	KnexStore.prototype.touch = function(sid, sess, fn) {
		if (sess && sess.cookie && sess.cookie.expires) {
			var condition = expiredCondition(this.knex);

			return this.knex(this.tablename)
				.where(this.sidfieldname, '=', sid)
				.andWhereRaw(condition, dateAsISO(this.knex))
				.update({
					expired: dateAsISO(this.knex, sess.cookie.expires)
				})
				.asCallback(fn);
		}

		fn();
	};


	/*
	* Destroy the session associated with the given `sid`.
	*
	* @param {String} sid
	* @api public
	*/
	KnexStore.prototype.destroy = function(sid, fn) {
		var self = this;
		return self.ready.then(function () {
			return self.knex.del()
			.from(self.tablename)
			.where(self.sidfieldname, '=', sid)
			.asCallback(fn)
		});
	};


	/*
	* Fetch number of sessions.
	*
	* @param {Function} fn
	* @api public
	*/
	KnexStore.prototype.length = function(fn) {
		var self = this;
		return self.ready.then(function () {
			return self.knex.count(self.sidfieldname + ' as count')
			.from(self.tablename)
			.then(function (response) {
				return response[0].count | 0;
			})
			.asCallback(fn)
		})
	};


	/*
	* Clear all sessions.
	*
	* @param {Function} fn
	* @api public
	*/
	KnexStore.prototype.clear = function(fn) {
		var self = this;
		return self.ready.then(function () {
			return self.knex.del()
			.from(self.tablename)
			.asCallback(fn)
		});
	};

	return KnexStore;

};
