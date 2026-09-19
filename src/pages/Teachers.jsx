import React from 'react';
import Staff from './Staff';

// Backward compatibility wrapper for Teachers component
const Teachers = (props) => {
  return <Staff {...props} />;
};

export default Teachers;
