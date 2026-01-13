const addoHours = (date, hours) => {
    const result = new Date (date);
    result.setHours(result.getHours() + hours);
    return result;
};

const isWithinNextHours = (date, hours) => {
    if (!date) return false;
    const now = new Date();
    const limit = addHours(now, hours);
    return date >= now && date <= limit;
};

module.exports = {
    addoHours,
    isWithinNextHours
};