var router = require('./rest-router');
var model = require('../../models/vegetation-zones');
var populatePath = 'properties.flore.taxon';
module.exports = router(model, populatePath, true);