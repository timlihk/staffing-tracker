import React from 'react';

const TestPage: React.FC = () => {
  return (
    <div style={{
      width: '100%',
      background: 'red',
      padding: 0,
      margin: 0,
      textAlign: 'left'
    }}>
      <div style={{
        background: 'blue',
        color: 'white',
        padding: '20px',
        margin: 0,
        width: '100%',
      }}>
        This should be at the LEFT edge. If there's space on the left, something is centering it.
      </div>
      <table style={{
        width: '100%',
        border: '2px solid green',
        margin: 0,
        borderCollapse: 'collapse'
      }}>
        <thead>
          <tr style={{ background: 'yellow' }}>
            <th>Column 1</th>
            <th>Column 2</th>
            <th>Column 3</th>
            <th>Column 4</th>
            <th>Column 5</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Data 1</td>
            <td>Data 2</td>
            <td>Data 3</td>
            <td>Data 4</td>
            <td>Data 5</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default TestPage;
