// Before (CommonJS)  
// module.exports = {  
//   plugins: [require('autoprefixer')]  
// };  

// After (ES Module)  
import autoprefixer from 'autoprefixer';  

export default {  
  plugins: [autoprefixer]  
};  