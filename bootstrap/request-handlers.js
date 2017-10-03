const path                     = require('path');
const ROOT                     = path.join(__dirname, '../');
const fs                       = require('fs');
const fsE                      = require('fs-extra');
const mongoose                 = require('mongoose');
var async                      = require('asyncawait/async');
var await                      = require('asyncawait/await');
let acl                        = global.myCustomVars.acl;
let getPublicIP                = global.myCustomVars.getPublicIP;
let objectChild                = global.myCustomVars.objectChild;
let checkRequiredParams        = global.myCustomVars.checkRequiredParams;
let checkUnNullParams          = global.myCustomVars.checkUnNullParams;
let responseError              = global.myCustomVars.responseError;
let responseSuccess            = global.myCustomVars.responseSuccess;
let rename                     = global.myCustomVars.rename;
let propsName                  = global.myCustomVars.propsName;
let flatObjectModel            = global.myCustomVars.flatObjectModel;
let createSaveOrUpdateFunction = global.myCustomVars.createSaveOrUpdateFunction;
let exportFile                 = global.myCustomVars.exportFile;
let exportXLSX                 = global.myCustomVars.exportXLSX;
let exportZip                  = global.myCustomVars.exportZip;

let ACTION_CREATE                = global.myCustomVars.ACTION_CREATE;
let ACTION_EDIT                  = global.myCustomVars.ACTION_EDIT;
let STR_SEPERATOR                = global.myCustomVars.STR_SEPERATOR;
let STR_AUTOCOMPLETION_SEPERATOR = global.myCustomVars.STR_AUTOCOMPLETION_SEPERATOR;
let ORIGIN_TIME                  = global.myCustomVars.ORIGIN_TIME;
let NULL_TIMES                   = global.myCustomVars.NULL_TIMES;

let Log                         = mongoose.model('Log');

var getFieldsHandler = (options) => {
	var LABEL = options.LABEL;
	var PROP_FIELDS = options.PROP_FIELDS;
	return (req, res) => {
		res.json({
			status: 'success',
			fields: PROP_FIELDS.reduce((obj, curElement) => {
				let e = curElement;
				if (('type' in e) 
						&& (['Mixed', 'Unit'].indexOf(e.type) < 0) 
						&& (['maDeTai', 'fDiaDiemThuMau', 'fApproved'].indexOf(e.name) < 0)){
					obj[e.name] = LABEL[e.name];
				}
				return obj;
			}, {})
		})
	}
}
global.myCustomVars.getFieldsHandler = getFieldsHandler;

var getAllHandler = function (options) {
	return function (req, res) {
		async(() => {
			// ObjectModel.find({deleted_at: {$eq: null}}, {}, {skip: 0, limit: 10, sort: {created_at: -1}}, function (err, objectInstances) {
			var objectModelIdParamName = options.objectModelIdParamName;
			var objectBaseURL = options.objectBaseURL;
			var LABEL = options.LABEL;
			var objectModelLabel = options.objectModelLabel;
			var ObjectModel = options.ObjectModel;
			var UPLOAD_DESTINATION = options.UPLOAD_DESTINATION;
			var PROP_FIELDS = options.PROP_FIELDS;
			var PROP_FIELDS_OBJ = options.PROP_FIELDS_OBJ;
			var objectModelNames = options.objectModelNames;
			var objectModelName = options.objectModelName;
			var selection = {deleted_at: {$eq: null}};
			var userRoles = await(new Promise((resolve, reject) => {
				acl.userRoles(req.session.userId, (err, roles) => {
					// console.log('promised userRoles called');
					if (err){
						resolve([])
					}
					else {
						resolve(roles)
					}
				})
			}))
			// Default. User chỉ có thể xem những phiếu do chính mình tạo
			selection['owner.userId'] = req.user._id;

			if (userRoles.indexOf('manager') >= 0){
				// Chủ nhiệm đề tài có thể xem tất cả mẫu dữ liệu trong cùng đề tài
				delete selection['owner.userId'];
				selection['maDeTai.maDeTai'] = req.user.maDeTai;
			}

			if (userRoles.indexOf('admin') >= 0){
				// Admin, Xem tất
				delete selection['owner.userId']; // Xóa cả cái này nữa. Vì có thể có admin ko có manager role. :))
				delete selection['maDeTai.maDeTai'];
			}
			// ObjectModel.find(selection, {}, {skip: 0, limit: 10, sort: {created_at: -1}}, function (err, objectInstances) {
			
			// Filter
			for (let p in req.query) {
				let v = req.query[p].trim();
				if (p in PROP_FIELDS_OBJ){
					console.log('filter: ' + p);
					// console.log(PROP_FIELDS[PROP_FIELDS_OBJ[p]]);
					try {
						let prop = PROP_FIELDS[PROP_FIELDS_OBJ[p]];
						if (prop.type == 'String'){
							selection[prop.schemaProp + '.' + p] = new RegExp(v, 'i'); // bỏ qua chữ hoa chữ thường
						}
						else if (prop.type == 'Integer'){
							selection[prop.schemaProp + '.' + p] = parseInt(v);
						}
						else if (prop.type == 'Number'){
							selection[prop.schemaProp + '.' + p] = parseFloat(v);
						}
					}
					catch (e){
						console.log(e);
					}
				}
				else {
					console.log('unexpected: ' + p);
				}
			}
			// console.log(selection);
			ObjectModel.find(selection, {}, {sort: {created_at: -1}}, function (err, objectInstances) {
				if (err){
					console.log(err);
					return responseError(req, UPLOAD_DESTINATION, res, 500, ['error'], ['Error while reading database']);
				}
				// var d1 = new Date();
				objectInstances = JSON.parse(JSON.stringify(objectInstances));
				try {
					objectInstances.map((o, i) => {
						let id = o._id;
						let created_at = o.created_at;
						objectInstances[i] =  flatObjectModel(PROP_FIELDS, o);
						objectInstances[i]._id = id;
						objectInstances[i].created_at = created_at;
						let tmp = objectInstances[i];
						try {
							for(p in tmp){
								if (tmp[p] instanceof Array){ // Chỉ có những trường file đính kèm thì mới là Array
									let files = tmp[p];
									files.map((f, i) => {
										let url = '/uploads/' + objectModelName + '/' + f;
										let obj = {
											fileName: f.substring(f.lastIndexOf(STR_SEPERATOR) + STR_SEPERATOR.length),
											urlDirect: url,
											urlDownload: '/content/download' + url
										}
										files[i] = obj;
									})
								}
							}
						}
						catch (e){
							console.log(e);
						}
					})
				}
				catch (e){
					console.log(e);
				}
				// var d2 = new Date();
				// console.log("==================");
				// console.log("time: " + ((d2.getTime() - d1.getTime()) / 1000));
				// console.log("==================");
				if (req.query.display == 'html') {
					let coordinationArr = []
					let firstInstance = -1;
					objectInstances.map((instance, idx) => {
						try {
							let regex = /([0-9 ]+)(°|độ)([0-9 ]+)('|phút)([0-9 ]+)("|giây)/;
							let longitude = '';
							if (!(regex.test(instance.kinhDo.toLowerCase()))){
								// console.log('Tọa độ thực')
								longitude = parseFloat(instance.kinhDo.toLowerCase());
							}
							else {
								// console.log('Tọa độ rời rạc')
								let matches = instance.kinhDo.toLowerCase().match(regex);
								longitude = parseInt(matches[1]) + parseInt(matches[3]) / 60 + parseInt(matches[5]) / 60 / 60;
							}

							let latitude = '';
							if (!(regex.test(instance.viDo.toLowerCase()))){
								// console.log('Tọa độ thực')
								latitude = parseFloat(instance.viDo.toLowerCase());
							}
							else {
								// console.log('Tọa độ rời rạc')
								let matches = instance.viDo.toLowerCase().match(regex);
								latitude = parseInt(matches[1]) + parseInt(matches[3]) / 60 + parseInt(matches[5]) / 60 / 60;
							}
							if (longitude && latitude) {
								if (firstInstance == -1) {
									firstInstance = idx
								}
								coordinationArr.push([latitude, longitude])
							}
						} catch (e) {
							console.log(e);
						}
						
					})
					// return res.json({
					// 	coordinationArr: coordinationArr
					// })
					return res.render('display', {
						title: 'Chi tiết mẫu ' + objectModelLabel, 
						objectPath: objectBaseURL, 
						count: 1, 
						obj1: {kinhDo: objectInstances[firstInstance].kinhDo, viDo: objectInstances[firstInstance].viDo}, 
						objectModelId: '', props: propsName(PROP_FIELDS), 
						staticPath: UPLOAD_DESTINATION.substring(UPLOAD_DESTINATION.indexOf('public') + 'public'.length), 
						coordinationArr: coordinationArr
					});
				}
				return responseSuccess(res, ['status', objectModelNames, 'total'], ['success', objectInstances, objectInstances.length]);
			})
		})();
	}
}

global.myCustomVars.getAllHandler = getAllHandler;

var getAutoCompletionHandler = function (options) {
	return function (req, res) {
		// console.log(Object.keys(AutoCompletion.schema.paths));
		var AutoCompletion = options.AutoCompletion;
		var UPLOAD_DESTINATION = options.UPLOAD_DESTINATION;
		AutoCompletion.findOne({}, function (err, autoCompletion) {
			if (err){
				return responseError(req, UPLOAD_DESTINATION, res, 500, ['error'], ["Error while reading AutoCompletion data"]);
			}
			else{
				var props = [];
				var values = [];
				for (var prop in AutoCompletion.schema.paths){
					// console.log((prop + " : " + prop.localeCompare('_id')));
					if ((prop.localeCompare('_id') != 0) && (prop.localeCompare('__v') != 0)){
						props.push(prop);
						if (autoCompletion && (prop in autoCompletion)){
							values.push(autoCompletion[prop]);
						}
						else {
							values.push([]);
						}
					}
				}
				return responseSuccess(res, props, values);
			}
		})
	}
}

global.myCustomVars.getAutoCompletionHandler = getAutoCompletionHandler;

var getSingleHandler = function (options) {
	return function (req, res) {

		var ObjectModel = options.ObjectModel;
		var objectModelName = options.objectModelName;
		var PROP_FIELDS = options.PROP_FIELDS;
		let PROP_FIELDS_OBJ = options.PROP_FIELDS_OBJ;
		var UPLOAD_DESTINATION = options.UPLOAD_DESTINATION;
		var objectModelIdParamName = options.objectModelIdParamName;
		var objectBaseURL = options.objectBaseURL;
		var LABEL = options.LABEL;
		var objectModelLabel = options.objectModelLabel;
		options.req = req;
		ObjectModel.findById(req.params.objectModelIdParamName, function (err, objectInstance) {
			if (err){
				return responseError(req, UPLOAD_DESTINATION, res, 500, ['error'], ['Error while reading database']);
			}
			if (objectInstance){
				if (objectInstance.deleted_at){
					Log.find({action: {$eq: 'delete'}, "obj1._id": {$eq: mongoose.Types.ObjectId(req.params.objectModelIdParamName)}}, function (err, logs) {
						if (err || (logs.length < 1)){
							console.log(err);
							return responseError(req, UPLOAD_DESTINATION, res, 404, ['error'], ["Mẫu dữ liệu này đã bị xóa"]);
						}
						// console.log(logs);
						return responseError(req, UPLOAD_DESTINATION, res, 404, ['error'], ["Mẫu dữ liệu này đã bị xóa bởi " + logs[0].userFullName]);
					})
				}
				else {
					// return responseSuccess(res, ['objectInstance'], [objectInstance]);
					if (req.query.display == 'html'){
						let foi = flatObjectModel(PROP_FIELDS, objectInstance)
						if (foi.loai) {
							let field = PROP_FIELDS[PROP_FIELDS_OBJ['loai']].schemaProp + '.loai';
							let selection = {}
							selection[field] = foi.loai
							console.log(selection);
							ObjectModel.find(selection, (err, instances) => {
								let coordinationArr = []
								if (err) {
									console.log(err);
								} else {
									console.log('cung loai:', instances.length);
									instances.map(instance => {
										let regex = /([0-9 ]+)(°|độ)([0-9 ]+)('|phút)([0-9 ]+)("|giây)/;
										let longitude = '';
										if (!(regex.test(instance.duLieuThuMau.viTriToaDo.kinhDo.toLowerCase()))){
											// console.log('Tọa độ thực')
											longitude = parseFloat(instance.duLieuThuMau.viTriToaDo.kinhDo.toLowerCase());
										}
										else {
											// console.log('Tọa độ rời rạc')
											let matches = instance.duLieuThuMau.viTriToaDo.kinhDo.toLowerCase().match(regex);
											longitude = parseInt(matches[1]) + parseInt(matches[3]) / 60 + parseInt(matches[5]) / 60 / 60;
										}

										let latitude = '';
										if (!(regex.test(instance.duLieuThuMau.viTriToaDo.viDo.toLowerCase()))){
											// console.log('Tọa độ thực')
											latitude = parseFloat(instance.duLieuThuMau.viTriToaDo.viDo.toLowerCase());
										}
										else {
											// console.log('Tọa độ rời rạc')
											let matches = instance.duLieuThuMau.viTriToaDo.viDo.toLowerCase().match(regex);
											latitude = parseInt(matches[1]) + parseInt(matches[3]) / 60 + parseInt(matches[5]) / 60 / 60;
										}
										if (longitude && latitude) {
											coordinationArr.push([latitude, longitude])
										}
									})
								}
								return res.render('display', {title: 'Chi tiết mẫu ' + objectModelLabel, objectPath: objectBaseURL, count: 1, obj1: foi, objectModelId: objectInstance.id, props: propsName(PROP_FIELDS), staticPath: UPLOAD_DESTINATION.substring(UPLOAD_DESTINATION.indexOf('public') + 'public'.length), coordinationArr: coordinationArr});
							})
						} else {
							return res.render('display', {title: 'Chi tiết mẫu ' + objectModelLabel, objectPath: objectBaseURL, count: 1, obj1: foi, objectModelId: objectInstance.id, props: propsName(PROP_FIELDS), staticPath: UPLOAD_DESTINATION.substring(UPLOAD_DESTINATION.indexOf('public') + 'public'.length), coordinationArr: null});
						}
						
					}
					else if (req.query.display == 'nested') {
						return responseSuccess(res, [objectModelName], [objectInstance]);
					}
					else if (['docx', 'pdf', 'xlsx', 'zip'].indexOf(req.query.display) >= 0){

						console.log('combined');
						
						var paragraph = options.paragraph;
						
						var exportFuncs = {
							docx: exportFile,
							pdf: exportFile,
							xlsx: exportXLSX,
							zip: exportZip
						}
						exportFuncs[req.query.display](objectInstance, options, res, req.query.display);
						// return res.end("OK");
					}
					
					else {
						if (req.query.filename == 'raw'){
							return responseSuccess(res, [objectModelName], [flatObjectModel(PROP_FIELDS, objectInstance)]);
						}
						else {
							let tmp = flatObjectModel(PROP_FIELDS, objectInstance);
							try {
								for(p in tmp){
									if (tmp[p] instanceof Array){ // Chỉ có những trường file đính kèm thì mới là Array
										let files = tmp[p];
										files.map((f, i) => {
											let url = '/uploads/' + objectModelName + '/' + f;
											let obj = {
												fileName: f.substring(f.lastIndexOf(STR_SEPERATOR) + STR_SEPERATOR.length),
												urlDirect: url,
												urlDownload: '/content/download' + url
											}
											files[i] = obj;
										})
									}
								}
							}
							catch (e){
								console.log(e);
							}
							return responseSuccess(res, [objectModelName], [tmp]);
						}
					}
					
				}
			}
			else{
				responseError(req, UPLOAD_DESTINATION, res, 404, ['error'], ['Không tìm thấy']);
			}
		})
	}
}

global.myCustomVars.getSingleHandler = getSingleHandler;

var duplicateHandler = function (options) {
	return function (req, res) {

		var ObjectModel = options.ObjectModel;
		var objectModelName = options.objectModelName;
		var PROP_FIELDS = options.PROP_FIELDS;
		let PROP_FIELDS_OBJ = options.PROP_FIELDS_OBJ
		var UPLOAD_DESTINATION = options.UPLOAD_DESTINATION;
		var objectModelIdParamName = options.objectModelIdParamName;
		var objectBaseURL = options.objectBaseURL;
		var LABEL = options.LABEL;
		var objectModelLabel = options.objectModelLabel;
		options.req = req;
		ObjectModel.findById(req.body[objectModelIdParamName], function (err, objectInstance) {
			if (err){
				return responseError(req, UPLOAD_DESTINATION, res, 500, ['error'], ['Error while reading database']);
			}
			if (objectInstance){
				if (objectInstance.deleted_at){
					Log.find({action: {$eq: 'delete'}, "obj1._id": {$eq: mongoose.Types.ObjectId(req.body[objectModelIdParamName])}}, function (err, logs) {
						if (err || (logs.length < 1)){
							console.log(err);
							return responseError(req, UPLOAD_DESTINATION, res, 404, ['error'], ["Mẫu dữ liệu này đã bị xóa"]);
						}
						// console.log(logs);
						return responseError(req, UPLOAD_DESTINATION, res, 404, ['error'], ["Mẫu dữ liệu này đã bị xóa bởi " + logs[0].userFullName]);
					})
				}
				else {
					// TODO
					// Need to check if this user can view this data or not !!!
					let newInstance = new ObjectModel(objectInstance);
					newInstance._id = mongoose.Types.ObjectId();
					newInstance.isNew = true; // VERY IMPORTANT
					newInstance.created_at = new Date();
					delete newInstance.updated_at;
					newInstance.created_by = {
						userId: req.user._id,
						userFullName: req.user.fullname
					}
					delete newInstance.updated_by
					delete newInstance.deleted_by
					let tmp = flatObjectModel(PROP_FIELDS, newInstance);
					let duplicatedFiles = []
					for(p in tmp){
						if (tmp[p] instanceof Array){ // Chỉ có những trường file đính kèm thì mới là Array
							let files = tmp[p];
							objectChild(newInstance, PROP_FIELDS[PROP_FIELDS_OBJ[p]].schemaProp)[p] = []
							files.map((f, i) => {
								try {
									let duplicatedFileName = f.replace(objectInstance._id, newInstance._id);
									fsE.copySync(path.join(ROOT, UPLOAD_DESTINATION, f), path.join(ROOT, UPLOAD_DESTINATION, duplicatedFileName));
									duplicatedFiles.push(duplicatedFileName)
									objectChild(newInstance, PROP_FIELDS[PROP_FIELDS_OBJ[p]].schemaProp)[p].push(duplicatedFileName);
								} catch (e) {
									console.log(e);
								}
							})
						}
					}
					newInstance.save(err => {
						if (err) {
							console.log(err);
							for(f of duplicatedFiles) {
								try {
									fsE.removeSync(path.join(ROOT, UPLOAD_DESTINATION, f))
								} catch (e) {
									console.log(e);
								}
							}
							return responseError(req, UPLOAD_DESTINATION, res, 500, ['error'], [err])
						}
						let newLog = new Log();
						newLog.action = 'duplicate';
						newLog.time = new Date();
						newLog.objType = objectModelName;
						newLog.userId = req.user.id;
						newLog.obj1 = JSON.parse(JSON.stringify(newInstance))
						newLog.userFullName = req.user.fullname;
						newLog.save(err => {
							console.error('ERR: Save log failed. Try again');
							console.error(err);
							newLog.save(err_ => {
								console.error('ERR: Save log failed');
								console.error(err_);
								console.error(newLog);
							})
						});
						let r = flatObjectModel(PROP_FIELDS, newInstance);
						r.id = r._id = newInstance._id;
						return responseSuccess(res, [objectModelName], [r])
					})
				}
			}
			else{
				responseError(req, UPLOAD_DESTINATION, res, 404, ['error'], ['Không tìm thấy']);
			}
		})
	}
}

global.myCustomVars.duplicateHandler = duplicateHandler;

var chownHandler = function (options) {
	return function (req, res) {

		var ObjectModel = options.ObjectModel
		var UPLOAD_DESTINATION = options.UPLOAD_DESTINATION
		var objectModelIdParamName = options.objectModelIdParamName
		var objectBaseURL = options.objectBaseURL
		var objectModelName = options.objectModelName
		var PROP_FIELDS = options.PROP_FIELDS
		var PROP_FIELDS_OBJ = options.PROP_FIELDS_OBJ
		var LABEL = options.LABEL
		var objectModelLabel = options.objectModelLabel
		var aclMiddlewareBaseURL = options.aclMiddlewareBaseURL
		options.req = req;
		var nullParam = checkUnNullParams([objectModelIdParamName, 'userId'], req.body);

		if (nullParam){
			return responseError(req, '', res, 400, ['error'], ['Thiếu ' + nullParam])
		}
		async(() => {
			let oi = await (new Promise((resolve, reject) => {
				ObjectModel.findById(req.body[objectModelIdParamName], function (err, objectInstance) {
					if (err){
						responseError(req, UPLOAD_DESTINATION, res, 500, ['error'], ['Error while reading database']);
						return resolve(null);
					}
					if (objectInstance){
						if (objectInstance.deleted_at){
							Log.find({action: {$eq: 'delete'}, 
								"obj1._id": {$eq: mongoose.Types.ObjectId(req.body[objectModelIdParamName])}}, 
								function (err, logs) {
									if (err || (logs.length < 1)){
										console.log(err);
										responseError(req, UPLOAD_DESTINATION, res, 404, ['error'], ["Mẫu dữ liệu này đã bị xóa"]);
										return resolve(null)
									}
									// console.log(logs);
									responseError(req, UPLOAD_DESTINATION, res, 404, ['error'], 
										["Mẫu dữ liệu này đã bị xóa bởi " + logs[0].userFullName]);
									return resolve(null)
								}
							)
						}
						else {
							return resolve(objectInstance)
						}
					}
					else{
						responseError(req, UPLOAD_DESTINATION, res, 404, ['error'], ['Không tìm thấy']);
						return resolve(null)
					}
				})
			}))
			if (!oi) {
				return;
			}
			let maDeTai = oi.maDeTai.maDeTai;
			if (maDeTai != req.user.maDeTai) {
				return responseError(req, UPLOAD_DESTINATION, res, 403, ['error'],
					['Mẫu dữ liệu này thuộc mã đề tài ' + maDeTai + ', không thuộc quyền quản lý của bạn']);
			}
			if (oi.owner.userId == req.body.userId) {
				return responseError(req, UPLOAD_DESTINATION, res, 400, ['error'], 
					['Mẫu dữ liệu này hiện đang thuộc quyền quản lý của user ' + req.body.userId]);
			}
			let user = await (getUser(req.body.userId))
			if (!user) {
				return responseError(req, UPLOAD_DESTINATION, res, 400, ['error'], ['User không tồn tại'])
			}
			user = user.userNormal;
			if (user.maDeTai != req.user.maDeTai) {
				return responseError(req, UPLOAD_DESTINATION, res, 400, ['error'],
					['User ' + user.fullname + ' không nằm trong đề tài mà bạn quản lý']
				)
			}
			// now we have: user.maDeTai == maDeTai == req.user.maDeTai
			// TODO check if user have permission to view this type of form
			let per = await (new Promise((resolve, reject) => {
				acl.isAllowed(user.id, aclMiddlewareBaseURL, 'view', function (err, result) {
					if (err){
						console.log(err);
						responseError(req, UPLOAD_DESTINATION, res, 500, ['error'], ['Có lỗi xảy ra, vui lòng thử lại sau.'])
						resolve(null)
					}
					// console.log('result: ', result);
					if (result){
						resolve(true)
					}
					else {
						responseError(req, UPLOAD_DESTINATION, res, 500, ['error'],
							['User ' + user.fullname + ' không có quyền xem dữ liệu thuộc loại ' + objectModelLabel]
						)
						resolve(false)
					}
				});
			}))
			if (!per) {
				return;
			}
			let newLog = new Log();
			newLog.userId = req.session.userId;
			newLog.userFullName = req.user.fullname,
			newLog.action = 'chown',
			newLog.time = new Date(),
			newLog.objType = objectModelName,
			newLog.obj1 = JSON.parse(JSON.stringify(oi)),
			// newLog.obj2: Object,
			newLog.extra = {
				agent: req.headers['user-agent'],
				localIP: req.body.localIP,
				publicIP: getPublicIP(req)
			}
			oi.owner.userId = user.id
			oi.save((err, result) => {
				if (err) {
					console.log(err);
					return responseError(req, UPLOAD_DESTINATION, res, 500, ['error'], ['Có lỗi xảy ra, vui lòng thử lại sau'])
				}
				newLog.obj2 = JSON.parse(JSON.stringify(oi));
				newLog.save(err => {
					console.error('ERR: Save log failed. Try again');
					console.error(err);
					newLog.save(err_ => {
						console.error('ERR: Save log failed');
						console.error(err_);
						console.error(newLog);
					})
				});
				return responseSuccess(res, [], [])
			})
		})()
	}
}

global.myCustomVars.chownHandler = chownHandler;

// hanle route: objectBaseURL + '/log/:logId/:position'
var getLogHandler = function (options) {
	return function (req, res) {
		var UPLOAD_DESTINATION = options.UPLOAD_DESTINATION;
		var objectBaseURL = options.objectBaseURL;
		var PROP_FIELDS = options.PROP_FIELDS;
		Log.findById(req.params.logId, function (err, log) {
			if (err){
				return responseError(req, UPLOAD_DESTINATION, res, 500, ['error'], ['Error while reading database']);
			}
			if (log){
				if ((log.action == 'update') && (req.params.position == 'diff')){
					// return responseSuccess(res, ['obj1', 'obj2'], [flatObjectModel(PROP_FIELDS, log.obj1), flatObjectModel(PROP_FIELDS, log.obj2)]);
					return res.render('display', {
						title: 'Các cập nhật', 
						objectPath: objectBaseURL, 
						count: 2, 
						obj1: flatObjectModel(PROP_FIELDS, log.obj1), 
						obj2: flatObjectModel(PROP_FIELDS, log.obj2), 
						staticPath: UPLOAD_DESTINATION.substring(UPLOAD_DESTINATION.indexOf('public') + 'public'.length), 
						props: propsName(PROP_FIELDS)
					});
				}

				switch (parseInt(req.params.position)){
					case 1:
						if ('obj1' in log){
							// return responseSuccess(res, ['animal'], [flatObjectModel(PROP_FIELDS, log.obj1)])
							return res.render('display', {
								title: 'Dữ liệu chi tiết', 
								objectPath: objectBaseURL, 
								count: 1, 
								obj1: flatObjectModel(PROP_FIELDS, log.obj1), 
								obj2: {}, 
								staticPath: UPLOAD_DESTINATION.substring(UPLOAD_DESTINATION.indexOf('public') + 'public'.length), 
								props: propsName(PROP_FIELDS)
							});
						}
						else{
							return responseError(req, UPLOAD_DESTINATION, res, 400, ['error'], ['Invalid object'])
						}
					case 2:
						if (('obj2' in log) && (log.obj2)){
							return res.render('display', {title: 'Dữ liệu chi tiết', objectPath: objectBaseURL, count: 1, obj1: flatObjectModel(PROP_FIELDS, log.obj2), staticPath: UPLOAD_DESTINATION.substring(UPLOAD_DESTINATION.indexOf('public') + 'public'.length), props: propsName(PROP_FIELDS)});
							// return responseSuccess(res, ['animal'], [flatObjectModel(PROP_FIELDS, log.obj2)])
						}
						else{
							return responseError(req, UPLOAD_DESTINATION, res, 400, ['error'], ['Invalid object'])
						}
					default:
						return responseError(req, UPLOAD_DESTINATION, res, 400, ['error'], ['Invalid object'])
				}
			}
			else {
				return responseError(req, UPLOAD_DESTINATION, res, 400, ['error'], ['Invalid logId'])
			}
		})
	}
}

global.myCustomVars.getLogHandler = getLogHandler;

var deleteHandler = function (options) {
	return function (req, res) {
		async(() => {
			var objectModelIdParamName = options.objectModelIdParamName;
			var UPLOAD_DESTINATION = options.UPLOAD_DESTINATION;
			var objectModelName = options.objectModelName;
			var objectModelIdParamName = options.objectModelIdParamName
			var ObjectModel = options.ObjectModel;
			var missingParam = checkRequiredParams([objectModelIdParamName], req.body);
			if (missingParam){
				return responseError(req, UPLOAD_DESTINATION, res, 400, ['error'], ['Thiếu ' + missingParam]);
			}

			var objectInstance = await(new Promise((resolve, reject) => {
				ObjectModel.findById(req.body[objectModelIdParamName], function (err, objectInstance) {
					// console.log('function');
					if (err){
						console.log(err);
						responseError(req, UPLOAD_DESTINATION, res, 500, ['error'], ['Error while reading database']);
						resolve(null)
					}
					resolve(objectInstance);
				})
			}))
			if (objectInstance){
				var canDelete = false;
				var userRoles = await(new Promise((resolve, reject) => {
					acl.userRoles(req.session.userId, (err, roles) => {
						console.log('promised userRoles called');
						if (err){
							resolve([])
						}
						else {
							resolve(roles)
						}
					})
				}))

				if (userRoles.indexOf('admin') >= 0){
					// Nếu là Admin, xóa đẹp
					canDelete = true;
				}
				if ((userRoles.indexOf('manager') >= 0) && req.user.maDeTai == objectInstance.maDeTai.maDeTai){
					// Nếu là chủ nhiệm đề tài, cũng OK
					canDelete = true;
				}
				if ((objectInstance.owner.userId == req.user.id) && (req.user.maDeTai == objectInstance.maDeTai.maDeTai)){
					canDelete = true; // Nếu mẫu do chính user tạo, và mẫu vật nằm trong đề tài của user
					// Có thể sau khi user tạo mẫu ở đề tài A, sau đó user được phân sang đề tài B
					// => user không thể sửa, xóa mẫu vật do user tạo trong đề tài A trước đó
				}

				// ===
				
				// if (objectInstance.created_by.userId == req.user.id){
				// 	canDelete = true; // Nếu mẫu do chính user tạo, có thể xóa
				// }
				// if (req.user.level){
				// 	let level = parseInt(req.user.level);
				// 	if (level >= PERM_ACCESS_ALL){
				// 		canDelete = true; // Nếu là SUPERUSER, xóa đẹp
				// 	}
				// 	else if ((level >= PERM_ACCESS_SAME_MUSEUM) && (req.user.maDeTai == objectInstance.maDeTai.maDeTai)){
				// 		canDelete = true; // Nếu là chủ nhiệm đề tài, cũng OK
				// 	}
				// }
				
				if (!canDelete){
					return responseError(req, UPLOAD_DESTINATION, res, 403, ['error'], ['Bạn không có quyền xóa mẫu dữ liệu này'])
				}

				var date = new Date();
				objectInstance.deleted_at = date;
				objectInstance.save();
				var newLog = new Log();
				newLog.action = 'delete';
				newLog.userId = req.user.id;
				newLog.userFullName = req.user.fullname;
				newLog.objType = objectModelName;
				newLog.obj1 = objectInstance;
				newLog.time = date;
				newLog.save(err => {
					console.error('ERR: Save log failed. Try again');
					console.error(err);
					newLog.save(err_ => {
						console.error('ERR: Save log failed');
						console.error(err_);
						console.error(newLog);
					})
				});
				return responseSuccess(res, ['status'], ['success']);
			}
			else{
				return responseError(req, UPLOAD_DESTINATION, res, 400, ['error'], ['Invalid ' + objectModelIdParamName]);
			}
		})()
		// return res.end('ok');
	}
}

global.myCustomVars.deleteHandler = deleteHandler;

var deleteFileHander = options => {
	return (req, res, next) => {
		async(() => {
			let objectModelIdParamName = options.objectModelIdParamName
			let UPLOAD_DESTINATION = options.UPLOAD_DESTINATION
			let ObjectModel = options.ObjectModel
			let saveOrUpdate = options.saveOrUpdate;
			let PROP_FIELDS = options.PROP_FIELDS;
			let PROP_FIELDS_OBJ = options.PROP_FIELDS_OBJ;
			let form = options.form;
			// console.log(objectModelIdParamName);
			var missingParam = checkRequiredParams([objectModelIdParamName, 'randomStr', 'field', 'fileName'], req.body);
			if (missingParam){
				return responseError(req, UPLOAD_DESTINATION, res, 400, ['error'], ['Thiếu ' + missingParam]);  
			}
			// console.log(req.body.animalId);
			var objectModelId = '';
			try {
				// console.log(req.body[objectModelIdParamName]);
				objectModelId = mongoose.Types.ObjectId(req.body[objectModelIdParamName]);
			}
			catch (e){
				console.log(e);
				return responseError(req, UPLOAD_DESTINATION, res, 500, ['error'], [objectModelIdParamName + " không đúng"]);
			}
			var objectInstance = await(new Promise((resolve, reject) => {
				ObjectModel.findById(objectModelId, function (err, objectInstance) {
					if (err){
						console.log(err);
						responseError(req, UPLOAD_DESTINATION, res, 500, ['error'], ["Error while reading database"])
						resolve(null)
					}
					
					if (objectInstance && (!objectInstance.deleted_at)) {
						resolve(objectInstance);
					}

					else {
						responseError(req, UPLOAD_DESTINATION, res, 400, ['error'], [objectModelIdParamName + ' không đúng'])
						resolve(null)
					}
				})
			}))
			if (objectInstance){
				var canEdit = false;

				var userRoles = await(new Promise((resolve, reject) => {
					acl.userRoles(req.session.userId, (err, roles) => {
						console.log('promised userRoles called');
						if (err){
							resolve([])
						}
						else {
							resolve(roles)
						}
					})
				}))

				if (userRoles.indexOf('admin') >= 0){
					// Nếu là Admin, cập nhật đẹp
					canEdit = true;
				}
				if ((userRoles.indexOf('manager') >= 0) && req.user.maDeTai == objectInstance.maDeTai.maDeTai){
					// Nếu là chủ nhiệm đề tài, cũng OK
					canEdit = true;
				}
				if ((objectInstance.owner.userId == req.user.id) && (req.user.maDeTai == objectInstance.maDeTai.maDeTai)){
					canEdit = true; // Nếu mẫu do chính user tạo, và mẫu vật nằm trong đề tài của user
					// Có thể sau khi user tạo mẫu ở đề tài A, sau đó user được phân sang đề tài B
					// => user không thể sửa, xóa mẫu vật do user tạo trong đề tài A trước đó
				}

				// ===
				// if (objectInstance.created_by.userId == req.user.id){
				// 	canEdit = true; // Nếu mẫu do chính user tạo, có thể cập nhật
				// }
				// if (req.user.level){
				// 	let level = parseInt(req.user.level);
				// 	if (level >= PERM_ACCESS_ALL){
				// 		canEdit = true; // Nếu là SUPERUSER, cập nhật đẹp
				// 	}
				// 	else if ((level >= PERM_ACCESS_SAME_MUSEUM) && (req.user.maDeTai == objectInstance.maDeTai.maDeTai)){
				// 		canEdit = true; // Nếu là chủ nhiệm đề tài, cũng OK
				// 	}
				// }
				// ===

				if (!canEdit){
					return responseError(req, UPLOAD_DESTINATION, res, 403, ['error'],
						['Bạn không có quyền sửa đổi mẫu dữ liệu này']
					)
				}

				// return saveOrUpdate(req, res, objectInstance, ACTION_EDIT);
				let oldFileName = objectInstance.id + STR_SEPERATOR + req.body.field + STR_SEPERATOR + req.body.fileName;
				if (!(PROP_FIELDS_OBJ[req.body.field])) {
					return res.status(400).json({
						status: 'error',
						error: 'invalid field'
					})
				}
				console.log(oldFileName);
				let arr = objectChild(objectInstance, PROP_FIELDS[PROP_FIELDS_OBJ[req.body.field]].schemaProp) [req.body.field];
				let pos = arr.indexOf(oldFileName);
				let savedFiles = [];
				if (pos < 0) {
					let files = []
					fs.readdirSync(path.join(ROOT, TMP_UPLOAD_DIR), {encoding: 'utf8'}).map((fileName) => {
						let prefix = req.body.randomStr + STR_SEPERATOR + req.body.field + STR_SEPERATOR;
						if (fileName.indexOf(prefix) == 0) {
							files.push(fileName.substring(fileName.lastIndexOf(STR_SEPERATOR) + STR_SEPERATOR.length))
						}
					});
					arr.map(f => {
						savedFiles.push(f.split(STR_SEPERATOR)[f.split(STR_SEPERATOR).length - 1])
					})
					return res.status(400).json({
						status: 'error',
						error: 'file not found',
						files: files,
						savedFiles: savedFiles,
						form: form,
						id: objectInstance.id,
						randomStr: req.body.randomStr,
						field: req.body.field
					})
				}
				
				try {
					arr.splice(pos, 1);
					fs.unlinkSync(path.join(ROOT, UPLOAD_DESTINATION, oldFileName));
				} catch (e) {
					console.log(e);
				}

				objectInstance.save((err, oi) => {
					if (err) {
						console.log(err);
					}
					// TODO
					// Save log
					let files = []
					fs.readdirSync(path.join(ROOT, TMP_UPLOAD_DIR), {encoding: 'utf8'}).map((fileName) => {
						let prefix = req.body.randomStr + STR_SEPERATOR + req.body.field + STR_SEPERATOR;
						if (fileName.indexOf(prefix) == 0) {
							files.push(fileName.substring(fileName.lastIndexOf(STR_SEPERATOR) + STR_SEPERATOR.length))
						}
					});
					arr.map(f => {
						savedFiles.push(f.split(STR_SEPERATOR)[f.split(STR_SEPERATOR).length - 1])
					})
					return responseSuccess(res,
						['files', 'savedFiles', 'form', 'id', 'randomStr', 'field'],
						[files, savedFiles, form, objectInstance.id, req.body.randomStr, req.body.field]
					);
				})

			} else {
				return res.status(404).json({
					status: 'error',
					error: 'Not found'
				})
			}
		})();
	}
}

global.myCustomVars.deleteFileHander = deleteFileHander;

var putHandler = function (options) {
	return function (req, res, next) {
		// console.log(req.body);
		delete req.body.maDeTai;
		delete req.body.fApproved;

		async(() => {
			var objectModelIdParamName = options.objectModelIdParamName
			var UPLOAD_DESTINATION = options.UPLOAD_DESTINATION
			var ObjectModel = options.ObjectModel
			var saveOrUpdate = options.saveOrUpdate;
			// console.log(objectModelIdParamName);
			var missingParam = checkRequiredParams([objectModelIdParamName], req.body);
			if (missingParam){
				return responseError(req, UPLOAD_DESTINATION, res, 400, ['error'], ['Thiếu ' + missingParam]);  
			}
			// console.log(req.body.animalId);
			var objectModelId = '';
			try {
				// console.log(req.body[objectModelIdParamName]);
				objectModelId = mongoose.Types.ObjectId(req.body[objectModelIdParamName]);
			}
			catch (e){
				console.log(e);
				return responseError(req, UPLOAD_DESTINATION, res, 500, ['error'], [objectModelIdParamName + " không đúng"]);
			}
			var objectInstance = await(new Promise((resolve, reject) => {
				ObjectModel.findById(objectModelId, function (err, objectInstance) {
					if (err){
						console.log(err);
						responseError(req, UPLOAD_DESTINATION, res, 500, ['error'], ["Error while reading database"])
						resolve(null)
					}
					
					if (objectInstance && (!objectInstance.deleted_at)) {
						resolve(objectInstance);
					}

					else {
						responseError(req, UPLOAD_DESTINATION, res, 400, ['error'], [objectModelIdParamName + ' không đúng'])
						resolve(null)
					}
				})
			}))
			if (objectInstance){
				var canEdit = false;

				var userRoles = await(new Promise((resolve, reject) => {
					acl.userRoles(req.session.userId, (err, roles) => {
						console.log('promised userRoles called');
						if (err){
							resolve([])
						}
						else {
							resolve(roles)
						}
					})
				}))

				if (userRoles.indexOf('admin') >= 0){
					// Nếu là Admin, cập nhật đẹp
					canEdit = true;
				}
				if ((userRoles.indexOf('manager') >= 0) && req.user.maDeTai == objectInstance.maDeTai.maDeTai){
					// Nếu là chủ nhiệm đề tài, cũng OK
					canEdit = true;
				}
				if ((objectInstance.owner.userId == req.user.id) && (req.user.maDeTai == objectInstance.maDeTai.maDeTai)){
					canEdit = true; // Nếu mẫu do chính user tạo, và mẫu vật nằm trong đề tài của user
					// Có thể sau khi user tạo mẫu ở đề tài A, sau đó user được phân sang đề tài B
					// => user không thể sửa, xóa mẫu vật do user tạo trong đề tài A trước đó
				}

				// ===
				// if (objectInstance.created_by.userId == req.user.id){
				// 	canEdit = true; // Nếu mẫu do chính user tạo, có thể cập nhật
				// }
				// if (req.user.level){
				// 	let level = parseInt(req.user.level);
				// 	if (level >= PERM_ACCESS_ALL){
				// 		canEdit = true; // Nếu là SUPERUSER, cập nhật đẹp
				// 	}
				// 	else if ((level >= PERM_ACCESS_SAME_MUSEUM) && (req.user.maDeTai == objectInstance.maDeTai.maDeTai)){
				// 		canEdit = true; // Nếu là chủ nhiệm đề tài, cũng OK
				// 	}
				// }
				// ===

				if (!canEdit){
					return responseError(req, UPLOAD_DESTINATION, res, 403, ['error'],
						['Bạn không có quyền sửa đổi mẫu dữ liệu này']
					)
				}

				return saveOrUpdate(req, res, objectInstance, ACTION_EDIT);
			}
		})();
	}
}

global.myCustomVars.putHandler = putHandler;

var postHandler = function (options) {
	var ObjectModel = options.ObjectModel;
	var saveOrUpdate = options.saveOrUpdate;
	var UPLOAD_DESTINATION = options.UPLOAD_DESTINATION;
	return function (req, res, next) {
		var newInstance = new ObjectModel();

		if (!req.user.maDeTai){
			return responseError(req, UPLOAD_DESTINATION, res, 403, ['error'],
				['Tài khoản của bạn chưa được liên kết với bất kỳ bảo tàng nào. '
				+ 'Liên hệ chủ nhiệm đề tài để được cập nhật tài khoản.']
			);
		}

		newInstance.flag.fApproved = false;
		delete req.body.fApproved;

		newInstance.maDeTai.maDeTai = req.user.maDeTai;
		delete req.body.maDeTai;

		return saveOrUpdate(req, res, newInstance, ACTION_CREATE);
	}
}

global.myCustomVars.postHandler = postHandler;